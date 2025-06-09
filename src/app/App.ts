import { HTTPService, IHTTPService } from "./services/HTTPService";
import {
    IWebSocketService,
    WebSocketService,
} from "./services/WebSocketService";

export class App {
    private wss: IWebSocketService;
    private HTTPService: IHTTPService;

    connect() {
        this.wss.connect();
        this.HTTPService.connect();
    }

    constructor() {
        this.HTTPService = new HTTPService();
        this.wss = new WebSocketService();

        this.wss.addEventListener("message", (e: string) => {
            // console.log("event" + "...event".repeat(12));
        });
    }
}
