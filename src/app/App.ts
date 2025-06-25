import { MongoDBService } from "./services/data-base-services/DBService";
import { HTTPService, IHTTPService } from "./services/HTTPService";
import {
    IWebSocketService,
    TSerializedData,
    TWebsocketOutgoingMessage,
    WebSocketService,
} from "./services/WebSocketService";

import { Document, MongoClient, WithId } from "mongodb";

export class App {
    private db: MongoDBService; //IDBService
    private wss: IWebSocketService;
    private HTTPService: IHTTPService;

    connect() {
        this.wss.connect();
        this.HTTPService.connect();
    }

    constructor() {
        this.db = new MongoDBService(
            new MongoClient("mongodb://127.0.0.1:27017"),
        );

        this.HTTPService = new HTTPService();
        this.wss = new WebSocketService();

        this.wss.onConnection(async (e) => {
            const docsArr = this.db.client
                .db("daemon")
                .collection("log")
                .find({});

            const docs:WithId<Document>[] = await docsArr.toArray();

            const message: TWebsocketOutgoingMessage = {
                type: "message/story", 
                textContent: "",
                payload:docs,
            };

            const serializedMessage: TSerializedData = JSON.stringify(message);

            e.connection.send(serializedMessage);

        });

        this.wss.addEventListener({
            type: "message",
            handler: (eventDataString: string) => {
                console.log("its message dude");

                // let err:null|unknown = null;

                // try {
                //     const data = JSON.parse(eventDataString);

                // }
                // catch (err) {

                //     const errString: string = JSON.stringify(err);

                //     this.db.client.db('daemon').collection('errors').insertOne({
                //         date: Date.now(),
                //         message:JSON.stringify(errString),
                //     });
                // }

                this.db.client.db("daemon").collection("log").insertOne({
                    date: Date.now(),
                    message: eventDataString,
                });
            },
        });
    }
}
