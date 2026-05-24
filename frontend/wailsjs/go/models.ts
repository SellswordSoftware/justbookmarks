export namespace bookmarks {
	
	export class Bookmark {
	    id: string;
	    title: string;
	    url: string;
	    icon: string;
	    iconURI: string;
	    // Go type: time
	    addDate: any;
	    // Go type: time
	    lastModified: any;
	    meta: string;
	
	    static createFrom(source: any = {}) {
	        return new Bookmark(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.url = source["url"];
	        this.icon = source["icon"];
	        this.iconURI = source["iconURI"];
	        this.addDate = this.convertValues(source["addDate"], null);
	        this.lastModified = this.convertValues(source["lastModified"], null);
	        this.meta = source["meta"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BookmarkConflictItem {
	    folderPath: string;
	    existingTitle: string;
	    incomingTitle: string;
	    url: string;
	    existingMeta: string;
	    incomingMeta: string;
	
	    static createFrom(source: any = {}) {
	        return new BookmarkConflictItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.folderPath = source["folderPath"];
	        this.existingTitle = source["existingTitle"];
	        this.incomingTitle = source["incomingTitle"];
	        this.url = source["url"];
	        this.existingMeta = source["existingMeta"];
	        this.incomingMeta = source["incomingMeta"];
	    }
	}
	export class BookmarkIndexEntry {
	    nodeId: string;
	    title: string;
	    url: string;
	    folderPath: string;
	
	    static createFrom(source: any = {}) {
	        return new BookmarkIndexEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nodeId = source["nodeId"];
	        this.title = source["title"];
	        this.url = source["url"];
	        this.folderPath = source["folderPath"];
	    }
	}
	export class BookmarkMergeItem {
	    folderPath: string;
	    title: string;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new BookmarkMergeItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.folderPath = source["folderPath"];
	        this.title = source["title"];
	        this.url = source["url"];
	    }
	}
	export class BookmarkPatch {
	    title?: string;
	    url?: string;
	    icon?: string;
	    iconURI?: string;
	    meta?: string;
	
	    static createFrom(source: any = {}) {
	        return new BookmarkPatch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.url = source["url"];
	        this.icon = source["icon"];
	        this.iconURI = source["iconURI"];
	        this.meta = source["meta"];
	    }
	}
	export class Node {
	    type: number;
	    folder?: Folder;
	    bookmark?: Bookmark;
	
	    static createFrom(source: any = {}) {
	        return new Node(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.folder = this.convertValues(source["folder"], Folder);
	        this.bookmark = this.convertValues(source["bookmark"], Bookmark);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Folder {
	    id: string;
	    name: string;
	    icon: string;
	    // Go type: time
	    addDate: any;
	    // Go type: time
	    lastModified: any;
	    meta: string;
	    children: Node[];
	
	    static createFrom(source: any = {}) {
	        return new Folder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.icon = source["icon"];
	        this.addDate = this.convertValues(source["addDate"], null);
	        this.lastModified = this.convertValues(source["lastModified"], null);
	        this.meta = source["meta"];
	        this.children = this.convertValues(source["children"], Node);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FolderMergeItem {
	    path: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new FolderMergeItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	    }
	}
	export class HistoryState {
	    canUndo: boolean;
	    canRedo: boolean;
	    undoLabel: string;
	    redoLabel: string;
	
	    static createFrom(source: any = {}) {
	        return new HistoryState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.canUndo = source["canUndo"];
	        this.canRedo = source["canRedo"];
	        this.undoLabel = source["undoLabel"];
	        this.redoLabel = source["redoLabel"];
	    }
	}
	export class MergeApplyResult {
	    foldersAdded: number;
	    bookmarksAdded: number;
	    duplicatesSkipped: number;
	    potentialUpdates: number;
	
	    static createFrom(source: any = {}) {
	        return new MergeApplyResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.foldersAdded = source["foldersAdded"];
	        this.bookmarksAdded = source["bookmarksAdded"];
	        this.duplicatesSkipped = source["duplicatesSkipped"];
	        this.potentialUpdates = source["potentialUpdates"];
	    }
	}
	export class MergePreview {
	    foldersToAdd: FolderMergeItem[];
	    bookmarksToAdd: BookmarkMergeItem[];
	    duplicateBookmarks: BookmarkMergeItem[];
	    potentialUpdates: BookmarkConflictItem[];
	
	    static createFrom(source: any = {}) {
	        return new MergePreview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.foldersToAdd = this.convertValues(source["foldersToAdd"], FolderMergeItem);
	        this.bookmarksToAdd = this.convertValues(source["bookmarksToAdd"], BookmarkMergeItem);
	        this.duplicateBookmarks = this.convertValues(source["duplicateBookmarks"], BookmarkMergeItem);
	        this.potentialUpdates = this.convertValues(source["potentialUpdates"], BookmarkConflictItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

