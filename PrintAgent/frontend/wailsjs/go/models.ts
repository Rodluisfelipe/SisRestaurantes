export namespace main {
	
	export class Config {
	    apiUrl: string;
	    printKey: string;
	    printerName: string;
	    paperWidth: number;
	    autoCut: boolean;
	    testMode: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiUrl = source["apiUrl"];
	        this.printKey = source["printKey"];
	        this.printerName = source["printerName"];
	        this.paperWidth = source["paperWidth"];
	        this.autoCut = source["autoCut"];
	        this.testMode = source["testMode"];
	    }
	}

}

