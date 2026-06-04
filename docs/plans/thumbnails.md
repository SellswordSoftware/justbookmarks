For this bookmark-manager use case, the implementation should **not** try to screenshot from the Wails frontend. In Wails v2, treat the main Wails webview as your app UI only, and build a **separate Linux thumbnail worker** that uses WebKitGTK directly to load arbitrary external URLs, snapshot the rendered page, compress the image, base64 it, and store it inside the Netscape bookmarks HTML.

Wails v2.12.0 is the current v2 line shown in the official docs/changelog, and Wails v2 is still fundamentally a single-window style app API. Wails v3 is where Wails is moving to procedural multi-window support, but v3 is still separate/alpha-ish relative to v2. For v2, the cleanest implementation is therefore a helper thumbnailer rather than trying to create hidden secondary Wails windows. Wails v2 binds Go methods to the frontend and loads your frontend assets into a WebKit-backed window; that is perfect for the bookmark UI, but not ideal as an arbitrary-site capture engine. ([Wails][1])

## Recommended architecture

```text
Wails v2 app
  frontend/
    bookmark UI
    calls Go: GenerateThumbnail(url)

  backend Go/
    validates URL
    checks thumbnail cache
    launches linux thumbnail helper
    receives optimized base64 data URL
    writes it into Netscape bookmarks HTML

  linux thumbnail helper
    GTK + WebKitGTK
    creates hidden/offscreen-ish capture window
    loads arbitrary URL
    waits for load + settle timeout
    snapshots WebKitWebView pixels
    resizes/crops
    JPEG/WebP/PNG encodes
    returns data:image/...;base64,...
```

The key design choice: **the external website should never be loaded in your main Wails webview**, because your Wails frontend has Go bindings available. Keep arbitrary external content in a separate process with no Wails bridge exposed.

## Why a helper process instead of doing it inside Wails v2?

Wails v2 is great for a single app window, but a thumbnailer wants a disposable, isolated, hidden browser context. Wails v3 introduces proper multi-window APIs; that contrast is a strong signal that v2 is not the right layer for managing a background fleet of hidden capture webviews. ([Wails][2])

Also, on Linux, WebKitGTK already has the snapshot primitive you need: `webkit_web_view_get_snapshot()` asynchronously retrieves a snapshot of a `WebKitWebView`, and you finish it with `webkit_web_view_get_snapshot_finish()`. ([WebKitGTK][3]) It can snapshot either the visible region or the full document; the enum values include `WEBKIT_SNAPSHOT_REGION_VISIBLE` and `WEBKIT_SNAPSHOT_REGION_FULL_DOCUMENT`. ([WebKitGTK][4])

For bookmark thumbnails, I’d use **visible viewport**, not full document. A full-page screenshot becomes tiny and unreadable after compression. A 16:9 top viewport is much more recognizable.

## Linux implementation details

### Important hidden-window reality

On Linux/WebKitGTK, do **not** assume a fully unmapped/invisible webview will render correctly. WebKitGTK snapshots are tied to a real `WebKitWebView`. GTK’s `OffscreenWindow` exists for snapshots of widgets, but WebKitWebView historically has issues inside `GtkOffscreenWindow`, and normal WebKitGTK APIs expect a real webview/widget hierarchy. GTK documents `GtkOffscreenWindow` as intended for snapshots of widgets outside a normal hierarchy, but WebKitGTK bug history shows WebKitWebView is not a great fit for it. ([https://docs.gtk.org][5])

The practical Linux strategy is:

```text
Create a normal GTK window
Set size to capture viewport, e.g. 1365x768
Do not expose it in the taskbar if possible
Move it offscreen where X11 permits
Set opacity low or skip presenting until needed where supported
Realize/map it enough for WebKit to render
Snapshot WebKitWebView directly
Destroy window
```

On Wayland, “move window offscreen” is generally not reliable because the compositor controls placement. So the helper should support two modes:

```text
Mode A: best effort hidden/offscreen capture
Mode B: tiny/non-focused capture window if compositor refuses hidden rendering
```

For a desktop bookmark manager, that is acceptable. In practice, captures happen quickly, and you can queue them so the user is not constantly seeing windows flash.

## Thumbnail format for Netscape bookmarks HTML

Netscape Bookmark File Format is basically HTML with bookmark metadata stored as attributes on `<A>` tags. Firefox exports extra attributes like `ICON` and `ICON_URI` for favicons, where `ICON` may contain a `data:image/...;base64,...` value. ([Mozilla Support][6])

For your own app, I would store:

```html
<DT>
  <A
    HREF="https://example.com/"
    ADD_DATE="1791139200"
    LAST_VISIT="1791139300"
    ICON="data:image/png;base64,...small-favicon..."
    THUMBNAIL="data:image/jpeg;base64,...small-page-thumbnail..."
    THUMB_W="240"
    THUMB_H="135"
    THUMB_MIME="image/jpeg"
  >Example</A>
```

`ICON` keeps compatibility with existing bookmark conventions. `THUMBNAIL`, `THUMB_W`, `THUMB_H`, and `THUMB_MIME` are your app’s private extension attributes.

Data URLs use the form `data:[<mediatype>][;base64],<data>`, which is defined by RFC 2397. ([IETF Datatracker][7]) MDN also documents base64 as the normal way to safely represent binary data inside data URLs. ([MDN Web Docs][8])

## Image size target

Because the image is embedded directly in HTML, keep it small.

Recommended defaults:

```text
Capture viewport: 1365x768
Thumbnail output: 240x135
Format: JPEG
Quality: 45–60
Target encoded binary: 6–18 KB
Base64 size: roughly 8–24 KB
```

Why JPEG? With a no-dependency Go implementation, `image/jpeg` is in the standard library. WebP would usually be smaller, but encoding WebP in Go normally means an extra dependency or using system `libwebp`. Since you prefer low-churn/self-buildable, start with JPEG.

For visually simple pages, PNG may sometimes be smaller, but for arbitrary websites JPEG usually wins.

## Main Wails-side API

Frontend:

```js
async function addBookmark(url) {
  const bookmark = await window.go.App.AddBookmark(url);

  renderBookmark({
    title: bookmark.title,
    url: bookmark.url,
    thumbnail: bookmark.thumbnailDataURL,
  });
}
```

Go app method:

```go
type App struct {
    ctx       context.Context
    store     *BookmarkStore
    thumbs    *ThumbnailService
}

func (a *App) AddBookmark(rawURL string) (*Bookmark, error) {
    u, err := NormalizeURL(rawURL)
    if err != nil {
        return nil, err
    }

    b := &Bookmark{
        URL:     u.String(),
        AddDate: time.Now().Unix(),
    }

    // Optional: fetch title/metadata separately with net/http.
    // Do not block forever on thumbnails.
    thumb, err := a.thumbs.Generate(a.ctx, u.String(), ThumbOptions{
        Width:        240,
        Height:       135,
        CaptureWidth: 1365,
        CaptureHeight: 768,
        JPEGQuality:  52,
        Timeout:      12 * time.Second,
    })

    if err == nil {
        b.ThumbnailDataURL = thumb.DataURL
        b.ThumbWidth = thumb.Width
        b.ThumbHeight = thumb.Height
        b.ThumbMime = thumb.Mime
    } else {
        b.ThumbnailStatus = "failed"
    }

    if err := a.store.Upsert(b); err != nil {
        return nil, err
    }

    if err := a.store.WriteNetscapeHTML(); err != nil {
        return nil, err
    }

    return b, nil
}
```

## Thumbnail service in Go

This lives in the Wails backend and spawns the Linux capture helper.

```go
type ThumbOptions struct {
    Width         int
    Height        int
    CaptureWidth  int
    CaptureHeight int
    JPEGQuality   int
    Timeout       time.Duration
}

type ThumbResult struct {
    DataURL string
    Mime    string
    Width   int
    Height  int
    Bytes   int
}

type ThumbnailService struct {
    HelperPath string
    CacheDir   string
}

func (s *ThumbnailService) Generate(
    ctx context.Context,
    url string,
    opt ThumbOptions,
) (*ThumbResult, error) {
    key := sha256Hex(url + fmt.Sprintf("|%dx%d|q%d", opt.Width, opt.Height, opt.JPEGQuality))

    cached := filepath.Join(s.CacheDir, key+".json")
    if result, ok := readCachedThumb(cached); ok {
        return result, nil
    }

    ctx, cancel := context.WithTimeout(ctx, opt.Timeout+3*time.Second)
    defer cancel()

    req := map[string]any{
        "url":            url,
        "capture_width":  opt.CaptureWidth,
        "capture_height": opt.CaptureHeight,
        "thumb_width":    opt.Width,
        "thumb_height":   opt.Height,
        "jpeg_quality":   opt.JPEGQuality,
        "timeout_ms":     int(opt.Timeout / time.Millisecond),
    }

    stdin, _ := json.Marshal(req)

    cmd := exec.CommandContext(ctx, s.HelperPath)
    cmd.Stdin = bytes.NewReader(stdin)

    var stdout, stderr bytes.Buffer
    cmd.Stdout = &stdout
    cmd.Stderr = &stderr

    if err := cmd.Run(); err != nil {
        return nil, fmt.Errorf("thumbnail helper failed: %w: %s", err, stderr.String())
    }

    var res ThumbResult
    if err := json.Unmarshal(stdout.Bytes(), &res); err != nil {
        return nil, err
    }

    if res.DataURL == "" {
        return nil, errors.New("thumbnail helper returned empty image")
    }

    writeCachedThumb(cached, &res)
    return &res, nil
}
```

## Linux helper: process structure

The helper can be a small Go binary using CGO to call GTK/WebKitGTK directly.

Build tags:

```go
//go:build linux

package main
```

Pseudo entrypoint:

```go
func main() {
    var req CaptureRequest
    if err := json.NewDecoder(os.Stdin).Decode(&req); err != nil {
        fail(err)
    }

    if err := req.Validate(); err != nil {
        fail(err)
    }

    result, err := CaptureURL(req)
    if err != nil {
        fail(err)
    }

    json.NewEncoder(os.Stdout).Encode(result)
}
```

Request/response:

```go
type CaptureRequest struct {
    URL           string `json:"url"`
    CaptureWidth  int    `json:"capture_width"`
    CaptureHeight int    `json:"capture_height"`
    ThumbWidth    int    `json:"thumb_width"`
    ThumbHeight   int    `json:"thumb_height"`
    JPEGQuality   int    `json:"jpeg_quality"`
    TimeoutMS     int    `json:"timeout_ms"`
}

type CaptureResult struct {
    DataURL string `json:"data_url"`
    Mime    string `json:"mime"`
    Width   int    `json:"width"`
    Height  int    `json:"height"`
    Bytes   int    `json:"bytes"`
}
```

## Linux helper: WebKitGTK pseudocode

This is intentionally C-like pseudocode because the core GTK/WebKit calls are C APIs. You can wrap this from Go with CGO.

```c
int capture_url(CaptureRequest req, CaptureResult* out) {
    gtk_init(NULL, NULL);

    GtkWidget* window = gtk_window_new(GTK_WINDOW_TOPLEVEL);

    gtk_window_set_default_size(GTK_WINDOW(window),
                                req.capture_width,
                                req.capture_height);

    gtk_window_set_decorated(GTK_WINDOW(window), FALSE);
    gtk_window_set_skip_taskbar_hint(GTK_WINDOW(window), TRUE);
    gtk_window_set_skip_pager_hint(GTK_WINDOW(window), TRUE);
    gtk_window_set_accept_focus(GTK_WINDOW(window), FALSE);

    // Best effort. Works better under X11 than Wayland.
    gtk_window_move(GTK_WINDOW(window), -20000, -20000);

    WebKitWebContext* context = webkit_web_context_new();

    // Optional but recommended:
    // - use an isolated data manager/profile
    // - disable persistent cookies
    // - disable unnecessary features
    WebKitSettings* settings = webkit_settings_new_with_settings(
        "enable-javascript", TRUE,
        "enable-plugins", FALSE,
        "auto-load-images", TRUE,
        NULL
    );

    WebKitWebView* webview = WEBKIT_WEB_VIEW(
        webkit_web_view_new_with_context(context)
    );

    webkit_web_view_set_settings(webview, settings);

    gtk_container_add(GTK_CONTAINER(window), GTK_WIDGET(webview));
    gtk_widget_set_size_request(GTK_WIDGET(webview),
                                req.capture_width,
                                req.capture_height);

    gtk_widget_show_all(window);

    // Optional: immediately lower/minimize if compositor allows.
    gtk_window_iconify(GTK_WINDOW(window));

    CaptureState state = {
        .loaded = false,
        .failed = false,
        .timed_out = false,
        .snapshot_done = false
    };

    g_signal_connect(webview,
        "load-changed",
        G_CALLBACK(on_load_changed),
        &state
    );

    g_signal_connect(webview,
        "load-failed",
        G_CALLBACK(on_load_failed),
        &state
    );

    webkit_web_view_load_uri(webview, req.url);

    g_timeout_add(req.timeout_ms, on_timeout, &state);

    gtk_main();

    if (state.failed || state.timed_out) {
        return CAPTURE_ERR_LOAD;
    }

    // get_snapshot is async; callback calls webkit_web_view_get_snapshot_finish()
    webkit_web_view_get_snapshot(
        webview,
        WEBKIT_SNAPSHOT_REGION_VISIBLE,
        WEBKIT_SNAPSHOT_OPTIONS_NONE,
        NULL,
        on_snapshot_ready,
        &state
    );

    gtk_main();

    cairo_surface_t* surface = state.surface;
    // Convert cairo surface → raw RGBA bytes.
    // Return RGBA to Go or encode in C.
}
```

Load handler:

```c
void on_load_changed(WebKitWebView* webview,
                     WebKitLoadEvent event,
                     gpointer user_data) {
    CaptureState* state = user_data;

    if (event == WEBKIT_LOAD_FINISHED) {
        // Wait a little for lazy JS/rendering.
        g_timeout_add(1200, on_settle_done, state);
    }
}

gboolean on_settle_done(gpointer user_data) {
    CaptureState* state = user_data;
    state->loaded = true;
    gtk_main_quit();
    return G_SOURCE_REMOVE;
}
```

Snapshot handler:

```c
void on_snapshot_ready(GObject* source,
                       GAsyncResult* result,
                       gpointer user_data) {
    CaptureState* state = user_data;
    GError* error = NULL;

    cairo_surface_t* surface =
        webkit_web_view_get_snapshot_finish(
            WEBKIT_WEB_VIEW(source),
            result,
            &error
        );

    if (error != NULL) {
        state->failed = true;
        g_error_free(error);
    } else {
        state->surface = surface;
        state->snapshot_done = true;
    }

    gtk_main_quit();
}
```

The important API call is `webkit_web_view_get_snapshot()`, which WebKitGTK documents as async and finished by `webkit_web_view_get_snapshot_finish()`. ([WebKitGTK][3])

## Convert snapshot to thumbnail in Go

Once you have raw RGBA from the helper’s C layer, do resizing and JPEG encoding in Go.

No third-party dependency version first:

```go
func makeThumbnailJPEG(src image.Image, targetW, targetH, quality int) ([]byte, error) {
    cropped := centerCropToAspect(src, targetW, targetH)
    scaled := resizeBilinear(cropped, targetW, targetH)

    var buf bytes.Buffer
    err := jpeg.Encode(&buf, scaled, &jpeg.Options{Quality: quality})
    if err != nil {
        return nil, err
    }

    return buf.Bytes(), nil
}
```

Simple bilinear resize pseudocode:

```go
func resizeBilinear(src image.Image, w, h int) *image.RGBA {
    dst := image.NewRGBA(image.Rect(0, 0, w, h))

    sb := src.Bounds()
    sx := float64(sb.Dx()) / float64(w)
    sy := float64(sb.Dy()) / float64(h)

    for y := 0; y < h; y++ {
        for x := 0; x < w; x++ {
            srcX := float64(x)*sx + float64(sb.Min.X)
            srcY := float64(y)*sy + float64(sb.Min.Y)

            c := sampleBilinear(src, srcX, srcY)
            dst.Set(x, y, c)
        }
    }

    return dst
}
```

Data URL:

```go
func jpegDataURL(jpegBytes []byte) string {
    b64 := base64.StdEncoding.EncodeToString(jpegBytes)
    return "data:image/jpeg;base64," + b64
}
```

Return:

```go
return CaptureResult{
    DataURL: jpegDataURL(jpegBytes),
    Mime:    "image/jpeg",
    Width:   req.ThumbWidth,
    Height:  req.ThumbHeight,
    Bytes:   len(jpegBytes),
}
```

## Netscape bookmarks writer

Model:

```go
type Bookmark struct {
    URL              string
    Title            string
    AddDate          int64
    LastVisit        int64
    IconDataURL       string
    ThumbnailDataURL  string
    ThumbWidth        int
    ThumbHeight       int
    ThumbMime         string
}
```

Writer:

```go
func WriteNetscapeBookmarks(w io.Writer, bookmarks []Bookmark) error {
    fmt.Fprintln(w, `<!DOCTYPE NETSCAPE-Bookmark-file-1>`)
    fmt.Fprintln(w, `<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">`)
    fmt.Fprintln(w, `<TITLE>Bookmarks</TITLE>`)
    fmt.Fprintln(w, `<H1>Bookmarks</H1>`)
    fmt.Fprintln(w, `<DL><p>`)

    for _, b := range bookmarks {
        attrs := []string{
            `HREF="` + html.EscapeString(b.URL) + `"`,
            fmt.Sprintf(`ADD_DATE="%d"`, b.AddDate),
        }

        if b.IconDataURL != "" {
            attrs = append(attrs, `ICON="`+html.EscapeString(b.IconDataURL)+`"`)
        }

        if b.ThumbnailDataURL != "" {
            attrs = append(attrs,
                `THUMBNAIL="`+html.EscapeString(b.ThumbnailDataURL)+`"`,
                fmt.Sprintf(`THUMB_W="%d"`, b.ThumbWidth),
                fmt.Sprintf(`THUMB_H="%d"`, b.ThumbHeight),
                `THUMB_MIME="`+html.EscapeString(b.ThumbMime)+`"`,
            )
        }

        fmt.Fprintf(
            w,
            "    <DT><A %s>%s</A>\n",
            strings.Join(attrs, " "),
            html.EscapeString(b.Title),
        )
    }

    fmt.Fprintln(w, `</DL><p>`)
    return nil
}
```

Parser should preserve your private attributes:

```go
func parseBookmarkAnchor(n *html.Node) Bookmark {
    var b Bookmark

    for _, attr := range n.Attr {
        switch strings.ToUpper(attr.Key) {
        case "HREF":
            b.URL = attr.Val
        case "ADD_DATE":
            b.AddDate = parseUnix(attr.Val)
        case "ICON":
            b.IconDataURL = attr.Val
        case "THUMBNAIL":
            b.ThumbnailDataURL = attr.Val
        case "THUMB_W":
            b.ThumbWidth = atoi(attr.Val)
        case "THUMB_H":
            b.ThumbHeight = atoi(attr.Val)
        case "THUMB_MIME":
            b.ThumbMime = attr.Val
        }
    }

    b.Title = textContent(n)
    return b
}
```

## Queueing and refresh policy

Do not thumbnail every bookmark synchronously on import. Use a queue:

```go
type ThumbJob struct {
    URL      string
    Priority int
}

func (s *ThumbnailService) Worker(ctx context.Context) {
    for {
        select {
        case job := <-s.queue:
            s.generateAndPersist(ctx, job.URL)
        case <-ctx.Done():
            return
        }
    }
}
```

Suggested behavior:

```text
On add single bookmark:
  generate immediately, but with timeout

On importing many bookmarks:
  import text first
  show favicon/placeholders
  thumbnail lazily in background
  write bookmarks.html after each batch or at safe intervals

Refresh:
  recapture after 30–90 days
  recapture manually on user request
```

## Security hardening

Because you are rendering arbitrary external sites:

```text
- Never expose Wails Go bindings to the capture webview.
- Use a separate process.
- Use a separate temporary WebKit web context/profile.
- Disable plugins.
- Apply per-URL timeout.
- Limit concurrent captures to 1–2.
- Validate URL scheme: allow http/https only.
- Block file://, data:, javascript:, about:, localhost/private IPs unless user explicitly allows.
- Destroy the webview/window after capture.
```

For a bookmark manager, I would also default-block local network captures unless the user enables them:

```go
func IsAllowedCaptureURL(u *url.URL) bool {
    if u.Scheme != "http" && u.Scheme != "https" {
        return false
    }

    hostIP := resolveHost(u.Hostname())
    if isPrivateIP(hostIP) || isLoopback(hostIP) || isLinkLocal(hostIP) {
        return false
    }

    return true
}
```

## Practical MVP plan

Start with this order:

```text
1. Store bookmarks as Netscape HTML with custom THUMBNAIL attribute.
2. Add Wails Go method: AddBookmark(url).
3. Implement ThumbnailService that shells out to a Linux helper.
4. Implement Linux helper with GTK + WebKitGTK:
   - create window
   - create WebKitWebView
   - load URL
   - wait load-finished + 1.2s
   - call webkit_web_view_get_snapshot visible region
5. Convert snapshot to RGBA.
6. Resize to 240x135.
7. JPEG encode quality 52.
8. Base64 as data:image/jpeg;base64,...
9. Write to bookmark HTML.
10. Add async queue for bulk imports.
```

The end state is a single portable bookmark HTML file containing normal bookmark data plus embedded thumbnail data. Other browsers may ignore your custom `THUMBNAIL` attribute, but your app can round-trip it. For compatibility, keep `HREF`, `ADD_DATE`, title text, and optionally `ICON` conventional.

[1]: https://wails.io/changelog/?utm_source=chatgpt.com "Changelog"
[2]: https://v3.wails.io/whats-new/?utm_source=chatgpt.com "What's New in Wails v3"
[3]: https://webkitgtk.org/reference/webkit2gtk/2.40.0/method.WebView.get_snapshot.html "WebKit2.WebView.get_snapshot"
[4]: https://webkitgtk.org/reference/webkit2gtk/2.40.1/enum.SnapshotRegion.html "WebKit2.SnapshotRegion"
[5]: https://docs.gtk.org/gtk3/class.OffscreenWindow.html?utm_source=chatgpt.com "Gtk.OffscreenWindow"
[6]: https://support.mozilla.org/en-US/questions/847295?utm_source=chatgpt.com "export bookmarks.html files | Firefox Support Forum"
[7]: https://datatracker.ietf.org/doc/html/rfc2397?utm_source=chatgpt.com "RFC 2397 - The \"data\" URL scheme"
[8]: https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data?utm_source=chatgpt.com "data: URLs - URIs - MDN Web Docs - Mozilla"
