export namespace main {
	
	export class Account {
	    alias: string;
	    printKey: string;
	    comandaPrinter: string;
	    reciboPrinter: string;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Account(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.alias = source["alias"];
	        this.printKey = source["printKey"];
	        this.comandaPrinter = source["comandaPrinter"];
	        this.reciboPrinter = source["reciboPrinter"];
	        this.enabled = source["enabled"];
	    }
	}
	export class Printer {
	    id: string;
	    name: string;
	    paperWidth: number;
	    autoCut: boolean;
	    qrMode?: string;
	
	    static createFrom(source: any = {}) {
	        return new Printer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.paperWidth = source["paperWidth"];
	        this.autoCut = source["autoCut"];
	        this.qrMode = source["qrMode"];
	    }
	}
	export class Config {
	    apiUrl: string;
	    printers: Printer[];
	    accounts: Account[];
	    printKey?: string;
	    printerName?: string;
	    paperWidth?: number;
	    autoCut?: boolean;
	    testMode?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiUrl = source["apiUrl"];
	        this.printers = this.convertValues(source["printers"], Printer);
	        this.accounts = this.convertValues(source["accounts"], Account);
	        this.printKey = source["printKey"];
	        this.printerName = source["printerName"];
	        this.paperWidth = source["paperWidth"];
	        this.autoCut = source["autoCut"];
	        this.testMode = source["testMode"];
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

