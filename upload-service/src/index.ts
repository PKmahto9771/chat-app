
import express from "express";
import cors from "cors";
import simpleGit from "simple-git";
import { generate } from "./utils";
import { getAllFiles } from "./file";
import path from "path";
import { uploadFile } from "./aws";
import { createClient } from "redis";

const publisher = createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:6379`
});

const subscriber = createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:6379`
});

publisher.connect().catch(err => {
  console.error('Failed to connect publisher to Redis:', err);
});

subscriber.connect().catch(err => {
  console.error('Failed to connect subscriber to Redis:', err);
});

publisher.on('error', (err) => console.error('Publisher Redis Client Error', err));
subscriber.on('error', (err) => console.error('Subscriber Redis Client Error', err));


const app = express();
app.use(cors())
app.use(express.json());

app.post("/deploy", async (req, res) => {
    const repoUrl = req.body.repoUrl;
    const id = generate(); 
    await simpleGit().clone(repoUrl, path.join(__dirname, `output/${id}`));

    const files = getAllFiles(path.join(__dirname, `output/${id}`));

    files.forEach(async file => {
        await uploadFile(file.slice(__dirname.length + 1), file);
    })

    await new Promise((resolve) => setTimeout(resolve, 5000))
    publisher.lPush("build-queue", id);
    // INSERT => SQL
    // .create => 
    publisher.hSet("status", id, "uploaded");

    res.json({
        id: id
    })

});

app.get("/status", async (req, res) => {
    const id = req.query.id;
    const response = await subscriber.hGet("status", id as string);
    res.json({
        status: response
    })
})

app.listen(3000, ()=>{
    console.log("app is listening on 3000");
});
