import WebSocket, { WebSocketServer } from "ws";
import { v4 as uuidV4 } from "uuid";
import { error } from "console";

export interface IWebSocketService {
    connect(): void;
    // addEventListener(eventType: "message", eventListener: (e:string) => void): void;
    addEventListener(
        eventType: TWebSocketEventType,
        eventListener: TWebSocketEventListener,
    ): void;
}

export type TWebsocketMessage = {
    textContent: string;
    connectionId: string;
};

export type TWebSocketEventType = "message" | "other";
export type TWebSocketEventListener = (e: string) => void;

export class WebSocketService implements IWebSocketService {
    /** collections */
    private connectionsPool: Map<string, WebsocketConnection>;
    private eventListenersPool: Map<string, TWebSocketEventListener[]>;
    /** services */
    private ws: WebSocketServer | null;

    private generateUnicId(
        collection: Map<string, WebsocketConnection>,
        webSocket: WebSocket,
    ): string {
        /**
         * этот цикл продолжится до тех пор пока функция генерации уникального ключа
         * не выдаст действительно уникальный который не задан в этом Map как уже существующий ключ
         */
        while (true) {
            const uuid = uuidV4();
            const item = collection.get(uuid);
            if (item !== undefined) continue;
            this.connectionsPool.set(uuid, new WebsocketConnection(webSocket));
            return uuid;
        }
    }

    addEventListener(
        eventType: TWebSocketEventType,
        eventListener: TWebSocketEventListener,
    ): void {
        const listeners = this.eventListenersPool.get(eventType);

        if (listeners === undefined) {
            this.eventListenersPool.set(eventType, []);
        }

        this.eventListenersPool.get(eventType)?.push(eventListener);
    }

    emit(eventType: TWebSocketEventType, eventData: string) {
        const listeners = this.eventListenersPool.get(eventType);

        if (listeners === undefined) return;

        listeners.forEach((elem) => {
            elem(eventData);
        });
    }

    connect(): void {
        if (this.ws) return;

        // this.ws = new WebSocketServer({ host: "127.0.0.1", port: 8080 });
        const host = process.env.WEB_SERVER_HOST;
        // choice mode that dev or prod
        this.ws = new WebSocketServer({
            host: host || "127.0.0.1" /* "109.73.196.90" */,
            port: 8080,
        });

        this.ws.addListener("listening", () => {
            console.log("websocket-instance::linstening");
        });

        this.ws.addListener("connection", (webSocket) => {
            console.log("connection-connected::connection-event");

            const uuid = this.generateUnicId(this.connectionsPool, webSocket);
            this.connectionsPool.set(uuid, new WebsocketConnection(webSocket));
            console.log(
                "connection-connected::connection-added : length:",
                this.connectionsPool.size,
            );

            webSocket.addEventListener("message", (e) => {
                const data = e.data.toString();

                console.log({ data });

                try {
                    const jsonData = JSON.parse(data) as {
                        textContent: string;
                    };

                    console.log("connection-websocket::message");
                    console.log({ jsonData });
                    if (typeof jsonData === "object" && "payload" in jsonData) {
                        this.emit("message", jsonData.textContent);
                    } else {
                        this.emit("message", jsonData.textContent);
                    }

                    const textContent = jsonData.textContent;

                    /**
                     * все клиенты получают сообщение
                     */
                    this.connectionsPool.forEach((websocketConnection, key) => {
                        const websocketMessage: TWebsocketMessage = {
                            textContent,
                            connectionId: key,
                        };

                        websocketConnection.send(
                            JSON.stringify(websocketMessage),
                        );
                    });

                    console.log("message sent just now");
                } catch (err) {
                    console.log("connection-websocket::message");
                    console.log("JSON parsing is failed");
                }
            });

            webSocket.addEventListener("close", () => {
                console.log("connection-websocket::close");
            });

            webSocket.addEventListener("error", (e) => {
                console.log("concrete websocket::error", { error });
            });

            webSocket.addEventListener("open", () => {
                console.log("concrete websocket::open");
            });
        });

        this.ws.addListener("close", () => {
            console.log("connection closed");
        });

        this.ws.addListener("error", (error) => {
            console.log("we have some error: ", { error });
        });
    }

    constructor() {
        this.ws = null;

        this.eventListenersPool = new Map();
        this.connectionsPool = new Map();
    }
}

export interface IWebsocketConnection {
    send(message: string): void;
}

export class WebsocketConnection implements IWebsocketConnection {
    private subj: WebSocket;

    send(message: string): void {
        if (
            this.subj.readyState === this.subj.CLOSED ||
            this.subj.readyState === this.subj.CLOSING ||
            this.subj.readyState === this.subj.CONNECTING
        )
            return;

        this.subj.send(message);
    }

    constructor(websocket: WebSocket) {
        this.subj = websocket;
    }
}
