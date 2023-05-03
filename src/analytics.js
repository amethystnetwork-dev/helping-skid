import crypto from 'node:crypto';
import bodyParser from "body-parser";
import { METHODS } from 'node:http';

function mnt(app, method, path, handler) {
    app.use(path, (req, res, next) => {
        if(!req.method === method.toUpperCase()) return next();
        if(req.url.endsWith("/") && !path.endsWith("/")) req.url = req.url.slice(0, req.url.length - 1);
        if(req.url !== path) return next();
        try {
            handler(req, res, next);
        } catch(err) {
            next(err);
        }
    });
};

const visitors = new Map();
let visits = 0;
let peak = 0;

export default function(app) {
    for(const method of METHODS) {
        app[method] = (path, handler) => mnt(app, method, path, handler);
    };
    app.use("/data", bodyParser.text());

    app.GET("/data/data", (req, res) => {
        const now = Date.now();
        let live = 0;
        for(const [id, { ut }] of visitors) {
            if(now - ut < 60000) live++;
            else visitors.delete(id);
        }
        if(live > peak) peak = live;
        visits++;
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
            live,
            peak,
            visits
        }));
    });

    app.GET("/data/debug", (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([...visitors]));
    });

    app.GET("/data/create-id", (req, res) => {
        const id = crypto.randomUUID();
        visitors.set(id, {
            ut: Date.now(),
            creation: Date.now()
        });
        res.end(id);
    });

    app.POST("/data/visit", (req, res) => {
        visits++;
        res.end("OK");
    });

    app.POST("/data/check-id", (req, res) => {
        res.end(visitors.has(req.body).toString());
    });

    app.POST("/data/keep-alive", (req, res) => {
        if(!visitors.has(req.body)) return res.end("Invalid ID");
        visitors.set(req.body, {
            ut: Date.now(),
            ...visitors.get(req.body)
        });
        res.end("OK");
    });

    app.POST("/data/destroy", (req, res) => {
        if(!visitors.has(req.body)) return res.end("Invalid ID");
        visitors.delete(req.body);
        res.end("Deleted");
    });

    setInterval(() => {
        const now = Date.now();
        for(const [id, { ut }] of visitors) {
            if(now - ut >= 60000) visitors.delete(id);
        }
    }, 60000);
}
