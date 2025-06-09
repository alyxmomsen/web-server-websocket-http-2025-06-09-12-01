import express, { Express } from "express";
import path, { join, resolve } from "path";

export interface IHTTPService {
    connect(): void;
}

export class HTTPService implements IHTTPService {
    private server: Express;
    connect(): void {
        const port = 3001;
        const frontendPath = process.env.FRONTEND;

        if (frontendPath) {
            this.server.use(express.static(frontendPath));
        }

        this.server.listen(port, () => {
            console.log(`http service working on port ${port}`);
        });
    }
    constructor() {
        this.server = express();
    }
}
