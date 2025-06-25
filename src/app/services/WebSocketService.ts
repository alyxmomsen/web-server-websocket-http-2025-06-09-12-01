import WebSocket, { WebSocketServer } from "ws";
import { v4 as uuidV4 } from "uuid";
import { error } from "console";
import { Document, WithId } from "mongodb";

namespace WebSocketService {
    export type world = string;
}

// export type TWebsocketEventType

export type TWebsocketEvent =
    | {
          type: "connection";
          handler: TWebSocketEventHandler;
      }
    | {
          type: "message";
          handler: TWebSocketEventHandler;
      };

export interface IWebSocketService {
    connect(): void;
    // addEventListener(eventType: "message", eventListener: (e:string) => void): void;
    onConnection(listener: TOnConnectionHandler): void;
    addEventListener(
        { type, handler }: TWebsocketEvent,
        // { eventType: TWebSocketEventType;
        // eventListener: TWebSocketEventListener}
    ): void;
    emit({
        eventType,
        payload,
    }:
        | {
              eventType: "connection";
              payload: {
                  websocketConnection: IWebsocketConnection;
              };
          }
        | {
              eventType: "message";
              payload: string;
          }): void;
}

export type TOutgoingMessageType = "simple-message" | "all-messages";

export type TSerializedData = string;

// on front must be the same
export type TWebsocketOutgoingMessage = | ({
    type: "message/current";
    payload: null;
} & {
    textContent: string;
    // connectionId: string;
})
| ({
    type: "message/story";
    payload: WithId<Document>[];
} & {
    textContent: string
    // connectionId: string;
});

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

export type TWebSocketEventType = "message" | "connection";

export type TWebSocketEventHandler = (event: string) => void;
// export type TWebSocketEventListener

/* ----------------------------------------------------- */

export type TOnConnectionHandler = (e: {
    connection: IWebsocketConnection;
}) => Promise<void>;

export class WebSocketService implements IWebSocketService {
    /** collections */
    private connectionsPool: Map<string, WebsocketConnection>;
    private eventListenersPool: Map<
        TWebSocketEventType,
        TWebSocketEventHandler[]
    >;
    private onConnectListenersPool: TOnConnectionHandler[];
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

    onConnection(listener: TOnConnectionHandler): void {
        this.onConnectListenersPool.push(listener);
    }

    addEventListener({ type, handler: listener }: TWebsocketEvent): void {
        const listeners = this.eventListenersPool.get(type);

        if (listeners === undefined) {
            this.eventListenersPool.set(type, []);
        }

        this.eventListenersPool.get(type)?.push(listener);
    }

    emit({
        eventType,
        payload,
    }:
        | {
              eventType: "connection";
              payload: {
                  websocketConnection: IWebsocketConnection;
              };
          }
        | {
              eventType: "message";
              payload: string;
          }): void {
        /**
         * #todo:
         *
         * эмит должен быть либо перегружен,
         * если мы говорим об этом конкретном методе.
         *
         * для кейса eventType === 'connection'
         * в эмит должен быть передан объект класса Connection
         *
         */

        if (eventType === "connection") {
            this.onConnectListenersPool.forEach((listener) =>
                listener({ connection: payload.websocketConnection }),
            );
        }

        const listeners = this.eventListenersPool.get(eventType);

        if (listeners === undefined) return;

        listeners.forEach((listener) => {
            if (eventType === "message") {
                listener(payload);
            }
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
            const connection = new WebsocketConnection(webSocket);
            this.connectionsPool.set(uuid, connection);
            console.log(
                "connection-connected::connection-added : length:",
                this.connectionsPool.size,
            );

            this.emit({
                eventType: "connection",
                payload: {
                    websocketConnection: connection,
                },
            });

            this.connectionsPool.forEach((websocket, key) => {
                //middleware();

                websocket.send("we have a new connection");
            });

            // connection.send("hello friend");

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
                            sendToAllMessageBehavior(
                                this.connectionsPool,
                                action.payload,
                                (eventData: string) => {
                                    this.emit({
                                        eventType: "message",
                                        payload: eventData,
                                    });
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
        // websocket
        this.ws = null;
        if (this.ws !== null) this.ws;

        // collections
        this.eventListenersPool = new Map();
        this.connectionsPool = new Map();
        this.onConnectListenersPool = [];
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
    execute(payload: string, emit: (eventData: string) => void): void;
}

class MessageBehavior implements IMessageBehavior {
    //
    private connectionsPool: Map<string, IWebsocketConnection>;

    execute(payload: string, emit: (eventData: string) => void) {
        const textContent = payload;
        /**
         * все клиенты получают сообщение
         */
        this.connectionsPool.forEach((websocketConnection, key) => {
            const websocketMessage: TWebsocketOutgoingMessage = {
                type: "message/current",
                // connectionId: key,
                textContent:'',
                payload: null, // is this hard-code ?
            };
            websocketConnection.send(JSON.stringify(websocketMessage));
        });

        emit(textContent);
    }

    constructor(pool: Map<string, IWebsocketConnection>) {
        this.connectionsPool = pool;
    }
}

function sendToAllMessageBehavior(
    pool: Map<string, IWebsocketConnection>,
    payload: string,
    emit: (eventData: string) => void,
) {
    const textContent = payload;
    /**
     * все клиенты получают сообщение
     */
    pool.forEach((websocketConnection, key) => {
        const websocketMessage: TWebsocketOutgoingMessage = {
            type: "message/current",
            textContent,
            // connectionId: key,
            payload: null, // is this hard-code
        };
        websocketConnection.send(JSON.stringify(websocketMessage));
    });

    emit(textContent);
}

// функция для  создания websocket message
function websocketMessageCreator() {}
