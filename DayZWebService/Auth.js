const express = require('express');
const { MongoClient } = require("mongodb");
const jwt = require('jsonwebtoken');
var crypto = require('crypto');

const log = require("./log");

const config = require('./configLoader');

const router = express.Router();

router.post('/:GUID/:auth', (req, res)=>{
    if ( req.params.auth == config.ServerAuth ){
        runGetAuth(req, res, req.params.GUID);
    }else{
        res.status(401);
        res.json({ GUID: req.params.GUID, AuthToken: "ERROR" });
        log("AUTH ERROR: " + req.url + " Invalid Server Token", "warn");
    }
});

async function runGetAuth(req, res, GUID) {
    const client = new MongoClient(config.DBServer, { useUnifiedTopology: true });
    try{
        // Connect the client to the server       
        await client.connect(); 
        const db = client.db(config.DB);
        var collection = db.collection("Players");
        var query = { GUID: GUID };
        const options = { upsert: true };
        var AuthToken = makeAuthToken(GUID);
        var SaveToken = crypto.createHash('sha256').update(AuthToken).digest('base64');
        const updateDocValue  = { GUID: GUID, AUTH: SaveToken }
        const updateDoc = { $set: updateDocValue, };
        const result = await collection.updateOne(query, updateDoc, options);
        if (result.result.ok == 1){
            res.json({GUID: GUID, AUTH: AuthToken});
            log("Auth Token Generated for: " + GUID);
        } else {
            res.json({GUID: GUID, AUTH: "ERROR"});
            log("Error Generating Auth Token  for: " + GUID, "warn");
        }
    }catch(err){
        res.json({GUID: GUID, AUTH: "ERROR"});
        log("AUTH ERROR: " + req.url + " error: " + err, "warn");
    }finally{
        await client.close();
    }
};

function makeAuthToken(GUID) {
    const player = { GUID: GUID }; 
    var result = jwt.sign(player, config.ServerAuth, { expiresIn: 2800 });
    return result;
 }

module.exports = router;