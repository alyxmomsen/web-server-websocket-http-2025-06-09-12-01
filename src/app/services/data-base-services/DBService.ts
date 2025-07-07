import { MongoClient } from "mongodb";

export interface IDBService {
    connect(): Promise<void>;
    // execute(transactionBeh:IDBTransactionBeh): void;
}

export class MongoDBService implements IDBService {
    // #dev::temp : временно установил MongoDBService::client с модификатором public
    // потому что на
    public client: MongoClient;

    // execute(transactionBeh:IDBTransactionBeh): void {
    //     transactionBeh.execute(this.client);
    // }

    async connect(): Promise<void> {
        await this.client.connect();
    }

    constructor(mongoClient: MongoClient) {
        mongoClient.db("daemon").collection("log").insertOne({ test: "one" });

        this.client = mongoClient;
    }
}

// export interface IDBTransactionBeh {
//     execute(dbClient:MongoClient): void;
// }

// export class InsertTransaction implements IDBTransactionBeh {

//     execute(dbClient: MongoClient , payload:{payload:OptionalId<Document> , }): void {

//         const db = dbClient.db('Daemon');

//         const col = db.collection('users');

//         col.insertOne({
//             name:
//         });

//     }

// }
