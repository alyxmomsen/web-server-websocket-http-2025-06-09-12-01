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

export type TWebsocketOutgoingMessage = {
    textContent: string;
    connectionId: string;
};

// Такой же тип должен быть на фронте
export type TWebsocketIncomingMessage =
    | {
          type: "message";
          payload: string;
      }
    | {
          type: "command";
          payload: {
              action: { type: "insert"; payload: string };
          };
      };

export type TWebSocketEventType = "message" | "other";

export type TWebSocketEventListener = (e: string) => void;

/* ----------------------------------------------------- */

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

        listeners.forEach((listener) => {
            listener(eventData);
        });
    }

    connect(): void {
        if (this.ws) return;

        // this.ws = new WebSocketServer({ host: "127.0.0.1", port: 8080 });
        const host = process.env.WEB_SERVER_HOST;
        // choice mode that dev or prod
        this.ws = new WebSocketServer({
            // host: host || "127.0.0.1" /* "109.73.196.90" */,
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
                const serializedData = e.data.toString();

                try {
                    const action = JSON.parse(
                        serializedData,
                    ) as TWebsocketIncomingMessage;

                    console.log("connection-websocket::message");
                    console.log({ jsonData: action });

                    switch (action.type) {
                        case "message": {
                            new MessageBehavior(this.connectionsPool).execute(
                                action,
                                (
                                    actionType: TWebSocketEventType,
                                    eventData: string,
                                ) => {
                                    this.emit(actionType, eventData);
                                },
                            );
                            // const pl = jsonData.payload;
                            // const textContent = jsonData.payload;

                            // /**
                            //  * все клиенты получают сообщение
                            //  */
                            // this.connectionsPool.forEach(
                            //     (websocketConnection, key) => {
                            //         const websocketMessage: TWebsocketOutgoingMessage =
                            //             {
                            //                 textContent,
                            //                 connectionId: key,
                            //             };

                            //         websocketConnection.send(
                            //             JSON.stringify(websocketMessage),
                            //         );
                            //     },
                            // );

                            // this.emit("message", pl);
                            break;
                        }
                        case "command": {
                            const pl = action.payload;

                            break;
                        }
                    }

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
        if (this.ws !== null) this.ws;
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

interface IMessageBehavior {
    execute(
        action: { type: TWebSocketEventType; payload: string },
        fn: (eventType: TWebSocketEventType, eventData: string) => void,
    ): void;
}

class MessageBehavior implements IMessageBehavior {
    private connectionsPool: Map<string, IWebsocketConnection>;

    execute(
        action: { type: TWebSocketEventType; payload: string },
        emit: (eventType: TWebSocketEventType, eventData: string) => void,
    ) {
        const actionType = action.type;
        const textContent = action.payload;
        /**
         * все клиенты получают сообщение
         */

        console.log("hell o fr");
        this.connectionsPool.forEach((websocketConnection, key) => {
            console.log("hello friend");
            const websocketMessage: TWebsocketOutgoingMessage = {
                textContent,
                connectionId: key,
            };
            websocketConnection.send(JSON.stringify(websocketMessage));
        });

        emit(actionType, textContent);
    }

    constructor(pool: Map<string, IWebsocketConnection>) {
        this.connectionsPool = pool;
    }
}
