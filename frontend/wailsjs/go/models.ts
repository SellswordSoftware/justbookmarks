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

}

