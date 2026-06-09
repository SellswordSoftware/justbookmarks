use std::fs;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::dto::{
    BookmarkConflictItem, BookmarkCreateDto, BookmarkMergeItem, FolderMergeItem, MergeApplyResult,
    MergePreview, MoveResult, NodeDto, TreeStats,
};
use crate::models::{Bookmark, BookmarkIndexEntry, BookmarkPatch, FlatNode, Node, NodeType};

static ID_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone)]
pub struct SnapshotCommand {
    pub label: String,
    pub before: Vec<Node>,
    pub after: Vec<Node>,
}

pub fn generate_id() -> String {
    format!("node-{}", ID_COUNTER.fetch_add(1, Ordering::Relaxed))
}

pub fn current_timestamp() -> String {
    // Minimal UTC RFC3339 formatting without extra dependencies.
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    unix_to_rfc3339(secs)
}

fn unix_to_rfc3339(secs: i64) -> String {
    // UTC-only conversion adapted to avoid chrono/time dependencies.
    const SECS_PER_DAY: i64 = 86_400;
    let days = secs.div_euclid(SECS_PER_DAY);
    let seconds_of_day = secs.rem_euclid(SECS_PER_DAY);

    let (year, month, day) = civil_from_days(days);
    let hour = seconds_of_day / 3600;
    let minute = (seconds_of_day % 3600) / 60;
    let second = seconds_of_day % 60;

    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

fn rfc3339_to_unix(value: &str) -> Option<i64> {
    if value.is_empty() {
        return None;
    }
    let bytes = value.as_bytes();
    if bytes.len() < 20 {
        return None;
    }
    let year: i32 = value.get(0..4)?.parse().ok()?;
    let month: u32 = value.get(5..7)?.parse().ok()?;
    let day: u32 = value.get(8..10)?.parse().ok()?;
    let hour: u32 = value.get(11..13)?.parse().ok()?;
    let minute: u32 = value.get(14..16)?.parse().ok()?;
    let second: u32 = value.get(17..19)?.parse().ok()?;
    let days = days_from_civil(year, month, day);
    Some(days * 86_400 + i64::from(hour) * 3600 + i64::from(minute) * 60 + i64::from(second))
}

fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let year = year - if month <= 2 { 1 } else { 0 };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let month = month as i32;
    let doy = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5 + day as i32 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era as i64 * 146097 + doe as i64 - 719468
}

fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i32 + era as i32 * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    (y + if m <= 2 { 1 } else { 0 }, m as u32, d as u32)
}

fn parse_html_timestamp(value: &str) -> String {
    value
        .parse::<i64>()
        .ok()
        .map(unix_to_rfc3339)
        .unwrap_or_default()
}

fn html_timestamp_attr(value: &str) -> Option<i64> {
    rfc3339_to_unix(value)
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn unescape_html(value: &str) -> String {
    value
        .replace("&quot;", "\"")
        .replace("&gt;", ">")
        .replace("&lt;", "<")
        .replace("&amp;", "&")
}

pub fn load_file(path: &str) -> Result<Vec<Node>, String> {
    let data = fs::read_to_string(path).map_err(|e| format!("failed to read file: {e}"))?;
    parse_bookmarks_html(&data)
}

pub fn save_file(path: &str, tree: &[Node]) -> Result<(), String> {
    fs::write(path, serialize_bookmarks_html(tree)).map_err(|e| format!("failed to save bookmarks: {e}"))
}

pub fn parse_bookmarks_html(data: &str) -> Result<Vec<Node>, String> {
    if !data.to_ascii_lowercase().contains("<dl") {
        return Err("no bookmark data found (missing root <DL>)".to_string());
    }

    let lines: Vec<String> = data.lines().map(|line| line.trim().to_string()).collect();
    let mut index = 0usize;
    while index < lines.len() && !lines[index].to_ascii_lowercase().starts_with("<dl") {
        index += 1;
    }
    if index == lines.len() {
        return Err("no bookmark data found (missing root <DL>)".to_string());
    }
    index += 1;
    parse_dl_lines(&lines, &mut index)
}

fn parse_dl_lines(lines: &[String], index: &mut usize) -> Result<Vec<Node>, String> {
    let mut nodes = Vec::new();
    while *index < lines.len() {
        let line = lines[*index].trim();
        let lower = line.to_ascii_lowercase();
        if lower.starts_with("</dl") {
            *index += 1;
            break;
        }
        if lower.starts_with("<dt><h3") {
            let (tag_block, next_index) = collect_tag_block(lines, *index, "h3")?;
            let (attrs, name) = parse_tag(&tag_block, "h3")?;
            *index = next_index;
            while *index < lines.len() && lines[*index].trim().is_empty() {
                *index += 1;
            }
            let mut children = Vec::new();
            if *index < lines.len() && lines[*index].trim().to_ascii_lowercase().starts_with("<dl") {
                *index += 1;
                children = parse_dl_lines(lines, index)?;
            }
            let mut folder = Node::folder(generate_id(), unescape_html(&name));
            if let Some(f) = folder.folder.as_mut() {
                f.add_date = attrs.get("add_date").map(|v| parse_html_timestamp(v)).unwrap_or_default();
                f.last_modified = attrs
                    .get("last_modified")
                    .map(|v| parse_html_timestamp(v))
                    .unwrap_or_default();
                f.icon = attrs.get("icon").cloned().unwrap_or_default();
                f.meta = attrs.get("meta").cloned().unwrap_or_default();
                f.children = children;
            }
            nodes.push(folder);
            continue;
        }
        if lower.starts_with("<dt><a") {
            let (tag_block, next_index) = collect_tag_block(lines, *index, "a")?;
            let (attrs, title) = parse_tag(&tag_block, "a")?;
            let mut bookmark = Node::bookmark(
                generate_id(),
                unescape_html(&title),
                attrs.get("href").cloned().unwrap_or_default(),
            );
            if let Some(b) = bookmark.bookmark.as_mut() {
                b.add_date = attrs.get("add_date").map(|v| parse_html_timestamp(v)).unwrap_or_default();
                b.last_modified = attrs
                    .get("last_modified")
                    .map(|v| parse_html_timestamp(v))
                    .unwrap_or_default();
                b.icon = attrs.get("icon").cloned().unwrap_or_default();
                b.icon_uri = attrs
                    .get("icon_uri")
                    .or_else(|| attrs.get("iconuri"))
                    .cloned()
                    .unwrap_or_default();
                b.meta = attrs.get("meta").cloned().unwrap_or_default();
            }
            nodes.push(bookmark);
            *index = next_index;
            continue;
        }
        *index += 1;
    }
    Ok(nodes)
}

fn collect_tag_block(lines: &[String], start_index: usize, tag: &str) -> Result<(String, usize), String> {
    let close = format!("</{tag}>");
    let mut block = String::new();
    let mut index = start_index;
    while index < lines.len() {
        if !block.is_empty() {
            block.push('\n');
        }
        block.push_str(lines[index].trim());
        index += 1;
        if block.to_ascii_lowercase().contains(&close) {
            return Ok((block, index));
        }
    }
    Err(format!("missing </{tag}>"))
}

fn parse_tag(line: &str, tag: &str) -> Result<(std::collections::HashMap<String, String>, String), String> {
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let start = line.to_ascii_lowercase().find(&open).ok_or_else(|| format!("missing <{tag}>"))?;
    let gt = line[start..].find('>').ok_or_else(|| "unterminated tag".to_string())? + start;
    let end = line.to_ascii_lowercase().rfind(&close).ok_or_else(|| format!("missing </{tag}>"))?;
    let attr_src = &line[start + open.len()..gt];
    let inner = &line[gt + 1..end];
    Ok((parse_attrs(attr_src), inner.to_string()))
}

fn parse_attrs(src: &str) -> std::collections::HashMap<String, String> {
    let mut attrs = std::collections::HashMap::new();
    let bytes = src.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() {
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }
        if i >= bytes.len() {
            break;
        }
        let key_start = i;
        while i < bytes.len() && !bytes[i].is_ascii_whitespace() && bytes[i] != b'=' {
            i += 1;
        }
        let key = src[key_start..i].trim().to_ascii_lowercase();
        while i < bytes.len() && (bytes[i].is_ascii_whitespace() || bytes[i] == b'=') {
            i += 1;
        }
        if i >= bytes.len() || bytes[i] != b'"' {
            continue;
        }
        i += 1;
        let value_start = i;
        while i < bytes.len() && bytes[i] != b'"' {
            i += 1;
        }
        let value = src[value_start..i].to_string();
        attrs.insert(key, unescape_html(&value));
        if i < bytes.len() {
            i += 1;
        }
    }
    attrs
}

pub fn serialize_bookmarks_html(nodes: &[Node]) -> String {
    let mut out = String::from(
        "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n",
    );
    write_dl(&mut out, nodes, 0);
    out
}

fn write_dl(out: &mut String, nodes: &[Node], indent: usize) {
    write_indent(out, indent);
    out.push_str("<DL><p>\n");
    for node in nodes {
        match node.node_type {
            x if x == NodeType::Folder as u8 => write_folder(out, node, indent + 1),
            x if x == NodeType::Bookmark as u8 => write_bookmark(out, node, indent + 1),
            _ => {}
        }
    }
    write_indent(out, indent);
    out.push_str("</DL><p>\n");
}

fn write_folder(out: &mut String, node: &Node, indent: usize) {
    let Some(folder) = &node.folder else { return };
    write_indent(out, indent);
    out.push_str("<DT><H3");
    write_time_attr(out, "ADD_DATE", &folder.add_date);
    write_time_attr(out, "LAST_MODIFIED", &folder.last_modified);
    write_string_attr(out, "ICON", &folder.icon);
    write_string_attr(out, "META", &folder.meta);
    out.push('>');
    out.push_str(&escape_html(&folder.name));
    out.push_str("</H3>\n");
    write_dl(out, &folder.children, indent + 1);
}

fn write_bookmark(out: &mut String, node: &Node, indent: usize) {
    let Some(bookmark) = &node.bookmark else { return };
    write_indent(out, indent);
    out.push_str("<DT><A");
    write_string_attr(out, "HREF", &bookmark.url);
    write_time_attr(out, "ADD_DATE", &bookmark.add_date);
    write_time_attr(out, "LAST_MODIFIED", &bookmark.last_modified);
    write_string_attr(out, "ICON", &bookmark.icon);
    write_string_attr(out, "ICON_URI", &bookmark.icon_uri);
    write_string_attr(out, "META", &bookmark.meta);
    out.push('>');
    out.push_str(&escape_html(&bookmark.title));
    out.push_str("</A>\n");
}

fn write_indent(out: &mut String, indent: usize) {
    for _ in 0..indent {
        out.push_str("    ");
    }
}

fn write_string_attr(out: &mut String, key: &str, value: &str) {
    if !value.is_empty() {
        out.push_str(&format!(" {key}=\"{}\"", escape_html(value)));
    }
}

fn write_time_attr(out: &mut String, key: &str, value: &str) {
    if let Some(unix) = html_timestamp_attr(value) {
        out.push_str(&format!(" {key}=\"{unix}\""));
    }
}

pub fn flatten_tree(nodes: &[Node]) -> Vec<FlatNode> {
    let mut result = Vec::new();
    flatten_into(nodes, "", &mut result);
    result
}

fn flatten_into(nodes: &[Node], parent_id: &str, result: &mut Vec<FlatNode>) {
    for node in nodes {
        result.push(new_flat_node(node, parent_id));
        if let Some(folder) = &node.folder {
            flatten_into(&folder.children, &folder.id, result);
        }
    }
}

pub fn new_flat_node(node: &Node, parent_id: &str) -> FlatNode {
    match (&node.folder, &node.bookmark) {
        (Some(folder), None) => FlatNode {
            id: folder.id.clone(),
            node_type: NodeType::Folder as u8,
            parent_id: parent_id.to_string(),
            name: folder.name.clone(),
            icon: folder.icon.clone(),
            add_date: folder.add_date.clone(),
            last_modified: folder.last_modified.clone(),
            meta: folder.meta.clone(),
            child_count: folder.children.len() as i32,
            ..FlatNode::default()
        },
        (None, Some(bookmark)) => FlatNode {
            id: bookmark.id.clone(),
            node_type: NodeType::Bookmark as u8,
            parent_id: parent_id.to_string(),
            name: bookmark.title.clone(),
            url: bookmark.url.clone(),
            icon: bookmark.icon.clone(),
            icon_uri: bookmark.icon_uri.clone(),
            add_date: bookmark.add_date.clone(),
            last_modified: bookmark.last_modified.clone(),
            meta: bookmark.meta.clone(),
            child_count: 0,
        },
        _ => FlatNode::default(),
    }
}

pub fn build_flat_index(nodes: &[Node]) -> Vec<BookmarkIndexEntry> {
    let mut result = Vec::new();
    build_flat_index_into(nodes, "", &mut result);
    result
}

fn build_flat_index_into(nodes: &[Node], path: &str, result: &mut Vec<BookmarkIndexEntry>) {
    for node in nodes {
        if let Some(bookmark) = &node.bookmark {
            result.push(BookmarkIndexEntry {
                node_id: bookmark.id.clone(),
                title: bookmark.title.clone(),
                url: bookmark.url.clone(),
                folder_path: path.to_string(),
            });
        } else if let Some(folder) = &node.folder {
            let next_path = if path.is_empty() {
                folder.name.clone()
            } else {
                format!("{path} / {}", folder.name)
            };
            build_flat_index_into(&folder.children, &next_path, result);
        }
    }
}

pub fn collect_folder_nodes(nodes: &[Node]) -> Vec<NodeDto> {
    let mut result = Vec::new();
    collect_folders_into(nodes, &mut result);
    result
}

fn collect_folders_into(nodes: &[Node], result: &mut Vec<NodeDto>) {
    for node in nodes {
        if let Some(folder) = &node.folder {
            result.push(NodeDto::from(node.clone()));
            collect_folders_into(&folder.children, result);
        }
    }
}

pub fn tree_stats(nodes: &[Node]) -> TreeStats {
    let mut stats = TreeStats::default();
    count_nodes(nodes, &mut stats);
    stats
}

fn count_nodes(nodes: &[Node], stats: &mut TreeStats) {
    for node in nodes {
        if let Some(folder) = &node.folder {
            stats.folders += 1;
            count_nodes(&folder.children, stats);
        } else if node.bookmark.is_some() {
            stats.bookmarks += 1;
        }
    }
}

pub fn add_bookmark(tree: &mut Vec<Node>, parent_id: &str, input: BookmarkCreateDto) -> Result<FlatNode, String> {
    let mut bookmark = Bookmark::default();
    bookmark.id = generate_id();
    bookmark.title = input.title;
    bookmark.url = input.url;
    bookmark.icon = input.icon;
    bookmark.icon_uri = input.icon_uri;
    bookmark.meta = input.meta;
    bookmark.add_date = current_timestamp();
    bookmark.last_modified = current_timestamp();
    let node = Node::bookmark(bookmark.id.clone(), bookmark.title.clone(), bookmark.url.clone());
    let mut created = node.clone();
    created.bookmark = Some(bookmark);
    insert_node(tree, parent_id, created.clone())?;
    Ok(new_flat_node(&created, parent_id))
}

pub fn add_folder(tree: &mut Vec<Node>, parent_id: &str, name: &str) -> Result<FlatNode, String> {
    let mut folder = Node::folder(generate_id(), name.to_string());
    if let Some(f) = folder.folder.as_mut() {
        f.add_date = current_timestamp();
        f.last_modified = current_timestamp();
    }
    insert_node(tree, parent_id, folder.clone())?;
    Ok(new_flat_node(&folder, parent_id))
}

fn insert_node(tree: &mut Vec<Node>, parent_id: &str, node: Node) -> Result<(), String> {
    if parent_id.is_empty() {
        tree.push(node);
        return Ok(());
    }
    let Some(parent) = find_node_mut(tree, parent_id) else {
        return Err("node not found".to_string());
    };
    let Some(folder) = parent.folder.as_mut() else {
        return Err("cannot move into a bookmark (only folders)".to_string());
    };
    folder.children.push(node);
    Ok(())
}

pub fn update_bookmark(tree: &mut [Node], id: &str, patch: BookmarkPatch) -> Result<(), String> {
    let Some(node) = find_node_mut(tree, id) else {
        return Err("node not found".to_string());
    };
    let Some(bookmark) = node.bookmark.as_mut() else {
        return Err("node is not a bookmark".to_string());
    };
    if let Some(title) = patch.title { bookmark.title = title; }
    if let Some(url) = patch.url { bookmark.url = url; }
    if let Some(icon) = patch.icon { bookmark.icon = icon; }
    if let Some(icon_uri) = patch.icon_uri { bookmark.icon_uri = icon_uri; }
    if let Some(meta) = patch.meta { bookmark.meta = meta; }
    bookmark.last_modified = current_timestamp();
    Ok(())
}

pub fn update_folder_name(tree: &mut [Node], id: &str, name: &str) -> Result<(), String> {
    let Some(node) = find_node_mut(tree, id) else {
        return Err("node not found".to_string());
    };
    let Some(folder) = node.folder.as_mut() else {
        return Err("node is not a folder".to_string());
    };
    folder.name = name.to_string();
    folder.last_modified = current_timestamp();
    Ok(())
}

pub fn delete_node(tree: &mut Vec<Node>, id: &str) -> Result<(), String> {
    if remove_node(tree, id).is_some() {
        Ok(())
    } else {
        Err("node not found".to_string())
    }
}

pub fn delete_nodes(tree: &mut Vec<Node>, ids: &[String]) -> Result<(), String> {
    for id in ids {
        if !contains_node(tree, id) {
            return Err("node not found".to_string());
        }
    }
    let id_set: std::collections::HashSet<&str> = ids.iter().map(String::as_str).collect();
    filter_out_nodes(tree, &id_set);
    Ok(())
}

fn filter_out_nodes(nodes: &mut Vec<Node>, ids: &std::collections::HashSet<&str>) {
    nodes.retain(|node| !ids.contains(node.id.as_str()));
    for node in nodes {
        if let Some(folder) = node.folder.as_mut() {
            filter_out_nodes(&mut folder.children, ids);
        }
    }
}

pub fn move_node(tree: &mut Vec<Node>, node_id: &str, new_parent_id: &str, new_index: i32) -> Result<MoveResult, String> {
    if node_id == new_parent_id {
        return Err("cannot move folder into its own descendant".to_string());
    }
    if is_descendant(tree, node_id, new_parent_id) {
        return Err("cannot move folder into its own descendant".to_string());
    }
    ensure_folder_target(tree, new_parent_id)?;
    let old_parent_id = find_parent_id(tree, node_id).unwrap_or_default();
    let removed = remove_node(tree, node_id).ok_or_else(|| "node not found".to_string())?;
    let insert_parent_id = new_parent_id.to_string();
    let actual_new_index = insert_at(tree, &insert_parent_id, new_index, removed.clone())?;
    Ok(MoveResult {
        moved_nodes: vec![new_flat_node(&removed, &insert_parent_id)],
        old_parent_id,
        new_parent_id: insert_parent_id,
        new_index: actual_new_index,
    })
}

pub fn move_nodes(tree: &mut Vec<Node>, node_ids: &[String], target_folder_id: &str) -> Result<MoveResult, String> {
    ensure_folder_target(tree, target_folder_id)?;
    for id in node_ids {
        if !contains_node(tree, id) {
            return Err("node not found".to_string());
        }
        if id == target_folder_id || is_descendant(tree, id, target_folder_id) {
            return Err("cannot move folder into its own descendant".to_string());
        }
    }

    let mut moved = Vec::new();
    let old_parent_id = node_ids
        .first()
        .and_then(|id| find_parent_id(tree, id))
        .unwrap_or_default();
    for id in node_ids {
        let removed = remove_node(tree, id).ok_or_else(|| "node not found".to_string())?;
        moved.push(removed);
    }
    let Some(target) = find_node_mut(tree, target_folder_id) else {
        return Err("node not found".to_string());
    };
    let Some(folder) = target.folder.as_mut() else {
        return Err("cannot move into a bookmark (only folders)".to_string());
    };
    let mut flat = Vec::new();
    for node in moved {
        flat.push(new_flat_node(&node, target_folder_id));
        folder.children.push(node);
    }
    Ok(MoveResult {
        moved_nodes: flat,
        old_parent_id,
        new_parent_id: target_folder_id.to_string(),
        new_index: folder.children.len() as i32,
    })
}

fn insert_at(tree: &mut Vec<Node>, parent_id: &str, new_index: i32, node: Node) -> Result<i32, String> {
    if parent_id.is_empty() {
        let idx = new_index.clamp(0, tree.len() as i32) as usize;
        tree.insert(idx, node);
        return Ok(idx as i32);
    }
    let Some(parent) = find_node_mut(tree, parent_id) else {
        return Err("node not found".to_string());
    };
    let Some(folder) = parent.folder.as_mut() else {
        return Err("cannot move into a bookmark (only folders)".to_string());
    };
    let idx = new_index.clamp(0, folder.children.len() as i32) as usize;
    folder.children.insert(idx, node);
    Ok(idx as i32)
}

fn ensure_folder_target(tree: &[Node], parent_id: &str) -> Result<(), String> {
    if parent_id.is_empty() {
        return Ok(());
    }

    let Some(parent) = find_node(tree, parent_id) else {
        return Err("node not found".to_string());
    };
    if parent.folder.is_none() {
        return Err("cannot move into a bookmark (only folders)".to_string());
    }

    Ok(())
}

pub fn preview_merge(existing: &[Node], incoming: &[Node]) -> MergePreview {
    let mut preview = MergePreview::default();
    preview_nodes(existing, incoming, &mut Vec::new(), &mut preview);
    preview.folders_to_add.sort_by(|a, b| a.path.cmp(&b.path));
    preview.bookmarks_to_add.sort_by(compare_bookmark_items);
    preview.duplicate_bookmarks.sort_by(compare_bookmark_items);
    preview.potential_updates.sort_by(|a, b| {
        a.folder_path
            .cmp(&b.folder_path)
            .then(a.incoming_title.cmp(&b.incoming_title))
            .then(a.url.cmp(&b.url))
    });
    preview
}

fn compare_bookmark_items(a: &BookmarkMergeItem, b: &BookmarkMergeItem) -> std::cmp::Ordering {
    a.folder_path.cmp(&b.folder_path).then(a.title.cmp(&b.title)).then(a.url.cmp(&b.url))
}

fn preview_nodes(existing: &[Node], incoming: &[Node], path: &mut Vec<String>, preview: &mut MergePreview) {
    for node in incoming {
        if let Some(folder) = &node.folder {
            path.push(folder.name.clone());
            if let Some(existing_folder) = existing.iter().find_map(|n| n.folder.as_ref().filter(|f| f.name == folder.name)) {
                preview_nodes(&existing_folder.children, &folder.children, path, preview);
            } else {
                collect_folder_adds(folder, path, preview);
            }
            path.pop();
        } else if let Some(bookmark) = &node.bookmark {
            let item = BookmarkMergeItem {
                folder_path: path.join(" / "),
                title: bookmark.title.clone(),
                url: bookmark.url.clone(),
            };
            match classify_bookmark(existing, bookmark) {
                MergeMatch::Duplicate => preview.duplicate_bookmarks.push(item),
                MergeMatch::PotentialUpdate(existing_bookmark) => preview.potential_updates.push(BookmarkConflictItem {
                    folder_path: path.join(" / "),
                    existing_title: existing_bookmark.title.clone(),
                    incoming_title: bookmark.title.clone(),
                    url: bookmark.url.clone(),
                    existing_meta: existing_bookmark.meta.clone(),
                    incoming_meta: bookmark.meta.clone(),
                }),
                MergeMatch::None => preview.bookmarks_to_add.push(item),
            }
        }
    }
}

fn collect_folder_adds(folder: &crate::models::Folder, path: &[String], preview: &mut MergePreview) {
    preview.folders_to_add.push(FolderMergeItem {
        path: path.join(" / "),
        name: folder.name.clone(),
    });
    for child in &folder.children {
        if let Some(sub) = &child.folder {
            let mut next = path.to_vec();
            next.push(sub.name.clone());
            collect_folder_adds(sub, &next, preview);
        } else if let Some(bookmark) = &child.bookmark {
            preview.bookmarks_to_add.push(BookmarkMergeItem {
                folder_path: path.join(" / "),
                title: bookmark.title.clone(),
                url: bookmark.url.clone(),
            });
        }
    }
}

enum MergeMatch<'a> {
    None,
    Duplicate,
    PotentialUpdate(&'a Bookmark),
}

fn classify_bookmark<'a>(existing: &'a [Node], incoming: &Bookmark) -> MergeMatch<'a> {
    let mut same_url = None;
    for node in existing {
        if let Some(bookmark) = &node.bookmark {
            if bookmark.url != incoming.url {
                continue;
            }
            if bookmark.title == incoming.title
                && bookmark.meta == incoming.meta
                && bookmark.icon == incoming.icon
                && bookmark.icon_uri == incoming.icon_uri
            {
                return MergeMatch::Duplicate;
            }
            if same_url.is_none() {
                same_url = Some(bookmark);
            }
        }
    }
    same_url.map_or(MergeMatch::None, MergeMatch::PotentialUpdate)
}

pub fn apply_merge(existing: &mut Vec<Node>, incoming: &[Node]) -> MergeApplyResult {
    let mut result = MergeApplyResult::default();
    merge_nodes(existing, incoming, &mut result);
    result
}

fn merge_nodes(existing: &mut Vec<Node>, incoming: &[Node], result: &mut MergeApplyResult) {
    for node in incoming {
        if let Some(folder) = &node.folder {
            let idx = existing.iter().position(|n| n.folder.as_ref().map(|f| f.name.as_str()) == Some(folder.name.as_str()));
            if let Some(index) = idx {
                if let Some(existing_folder) = existing[index].folder.as_mut() {
                    merge_nodes(&mut existing_folder.children, &folder.children, result);
                }
            } else {
                let mut cloned = Node::folder(generate_id(), folder.name.clone());
                if let Some(new_folder) = cloned.folder.as_mut() {
                    new_folder.icon = folder.icon.clone();
                    new_folder.meta = folder.meta.clone();
                    new_folder.add_date = folder.add_date.clone();
                    new_folder.last_modified = folder.last_modified.clone();
                }
                existing.push(cloned);
                result.folders_added += 1;
                if let Some(last) = existing.last_mut().and_then(|n| n.folder.as_mut()) {
                    merge_nodes(&mut last.children, &folder.children, result);
                }
            }
        } else if let Some(bookmark) = &node.bookmark {
            match classify_bookmark(existing, bookmark) {
                MergeMatch::Duplicate => result.duplicates_skipped += 1,
                MergeMatch::PotentialUpdate(_) => result.potential_updates += 1,
                MergeMatch::None => {
                    let mut cloned = Node::bookmark(generate_id(), bookmark.title.clone(), bookmark.url.clone());
                    if let Some(new_bookmark) = cloned.bookmark.as_mut() {
                        new_bookmark.icon = bookmark.icon.clone();
                        new_bookmark.icon_uri = bookmark.icon_uri.clone();
                        new_bookmark.meta = bookmark.meta.clone();
                        new_bookmark.add_date = bookmark.add_date.clone();
                        new_bookmark.last_modified = bookmark.last_modified.clone();
                    }
                    existing.push(cloned);
                    result.bookmarks_added += 1;
                }
            }
        }
    }
}

pub fn find_node_mut<'a>(nodes: &'a mut [Node], id: &str) -> Option<&'a mut Node> {
    for node in nodes {
        if node.id == id {
            return Some(node);
        }
        if let Some(folder) = node.folder.as_mut() {
            if let Some(found) = find_node_mut(&mut folder.children, id) {
                return Some(found);
            }
        }
    }
    None
}

pub fn find_node<'a>(nodes: &'a [Node], id: &str) -> Option<&'a Node> {
    for node in nodes {
        if node.id == id {
            return Some(node);
        }
        if let Some(folder) = &node.folder {
            if let Some(found) = find_node(&folder.children, id) {
                return Some(found);
            }
        }
    }
    None
}

fn contains_node(nodes: &[Node], id: &str) -> bool {
    find_node(nodes, id).is_some()
}

pub fn find_parent_id(nodes: &[Node], child_id: &str) -> Option<String> {
    for node in nodes {
        if let Some(folder) = &node.folder {
            if folder.children.iter().any(|child| child.id == child_id) {
                return Some(folder.id.clone());
            }
            if let Some(found) = find_parent_id(&folder.children, child_id) {
                return Some(found);
            }
        }
    }
    None
}

fn is_descendant(nodes: &[Node], ancestor_id: &str, descendant_id: &str) -> bool {
    let Some(ancestor) = find_node(nodes, ancestor_id) else {
        return false;
    };
    let Some(folder) = &ancestor.folder else {
        return false;
    };
    contains_node(&folder.children, descendant_id)
}

fn remove_node(nodes: &mut Vec<Node>, id: &str) -> Option<Node> {
    if let Some(index) = nodes.iter().position(|node| node.id == id) {
        return Some(nodes.remove(index));
    }
    for node in nodes {
        if let Some(folder) = node.folder.as_mut() {
            if let Some(removed) = remove_node(&mut folder.children, id) {
                return Some(removed);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialize_round_trip_simple_tree() {
        let mut root = Node::folder("f1", "Folder");
        root.folder.as_mut().unwrap().children.push(Node::bookmark("b1", "Example", "https://example.com"));
        let tree = vec![root];
        let output = serialize_bookmarks_html(&tree);
        let reparsed = parse_bookmarks_html(&output).unwrap();
        assert_eq!(reparsed.len(), 1);
        assert_eq!(reparsed[0].folder.as_ref().unwrap().name, "Folder");
        assert_eq!(reparsed[0].folder.as_ref().unwrap().children[0].bookmark.as_ref().unwrap().title, "Example");
    }

    #[test]
    fn parses_multiline_bookmark_tag_with_meta() {
        let html = r#"<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1" LAST_MODIFIED="2">favorites bar!</H3>
    <DL><p>
        <DT><A HREF="https://radarr.hubspar.com" ADD_DATE="3" LAST_MODIFIED="4" META="Radarr is a thing

And stuff">Login - Radarr</A>
    </DL><p>
</DL><p>"#;

        let reparsed = parse_bookmarks_html(html).unwrap();
        let folder = reparsed[0].folder.as_ref().unwrap();
        let bookmark = folder.children[0].bookmark.as_ref().unwrap();
        assert_eq!(bookmark.title, "Login - Radarr");
        assert_eq!(bookmark.url, "https://radarr.hubspar.com");
        assert_eq!(bookmark.meta, "Radarr is a thing\n\nAnd stuff");
    }

    #[test]
    fn add_and_flatten_bookmark() {
        let mut tree = vec![Node::folder("f1", "Root")];
        let flat = add_bookmark(
            &mut tree,
            "f1",
            BookmarkCreateDto {
                title: "GitHub".into(),
                url: "https://github.com".into(),
                ..BookmarkCreateDto::default()
            },
        )
        .unwrap();
        assert_eq!(flat.parent_id, "f1");
        assert_eq!(flatten_tree(&tree).len(), 2);
    }
}
