const express = require('express');
const { MongoClient } = require("mongodb");
var crypto = require('crypto');

const log = require("./log");

const CheckAuth = require('./AuthChecker')

const config = require('./configLoader');

const queryHandler = require("./Query");
const TransactionHandler = require("./Transaction");
// Create a new MongoClient


const router = express.Router();
router.use('/Query', queryHandler);
router.use('/Transaction', TransactionHandler);
router.post('/Load/:GUID/:mod/:auth', (req, res)=>{
    runGet(req, res, req.params.GUID, req.params.mod, req.params.auth, false);
});

router.post('/Save/:GUID/:mod/:auth', (req, res)=>{
    runSave(req, res, req.params.GUID, req.params.mod, req.params.auth, true);
});

router.post('/Update/:GUID/:mod/:auth', (req, res)=>{
    runUpdate(req, res, req.params.GUID, req.params.mod, req.params.auth, true);
});

async function runGet(req, res, GUID, mod, auth) {
    if (  (auth === config.ServerAuth) || (await CheckPlayerAuth(GUID, auth))){
        const client = new MongoClient(config.DBServer, { useUnifiedTopology: true });
        try{

            await client.connect();
            // Connect the client to the server
            const db = client.db(config.DB);
            var collection = db.collection("Players");
            var query = { GUID: GUID };
            var results = collection.find(query);
            var StringData = JSON.stringify(req.body);
            var RawData = req.body;
            
            if ((await results.count()) == 0){
                if (auth === config.ServerAuth || config.AllowClientWrite){
                    log("Can't find Player with ID " + GUID + "Creating it now");
                    const doc  = JSON.parse("{ \"GUID\": \"" + GUID + "\", \""+mod+"\": "+ StringData + " }");
                    await collection.insertOne(doc);
                } else {
                    log("Can't find Player with ID " + GUID, "warn");
                }
                res.status(201);
                res.json(RawData);
            } else {
                var dataarr = await results.toArray(); 
                var data = dataarr[0]; 
                var sent = false;
                for (const [key, value] of Object.entries(data)) {
                    if(key === mod){
                        var sent = true;
                        res.json(value);
                        log("Retrieving "+ mod + " Data for GUID: " + GUID);
                    }
                }
                if (sent != true){
                    if (auth === config.ServerAuth || config.AllowClientWrite){
                        const updateDocValue  = JSON.parse("{ \""+mod+"\": "+ StringData + " }");
                        const updateDoc = { $set: updateDocValue, };
                        const options = { upsert: false };
                        await collection.updateOne(query, updateDoc, options);
                        log("Can't find "+ mod + " Data for GUID: " + GUID +  " Creating it now");
                    } else {
                        log("Can't find "+ mod + " Data for GUID: " + GUID, "warn");
                    }
                    res.status(203);
                    res.json(RawData);
                }
            }
        }catch(err){
            res.status(203);
            res.json(req.body);
            log("ERROR: " + err, "warn");
        }finally{
            // Ensures that the client will close when you finish/error
            client.close();
        }
    } else {
        res.status(401);
        res.json(req.body);
    }
};
async function runSave(req, res, GUID, mod, auth) {
    if ( auth == config.ServerAuth || ((await CheckPlayerAuth(GUID, auth)) && config.AllowClientWrite) ){
        const client = new MongoClient(config.DBServer, { useUnifiedTopology: true });
        try{
            await client.connect();

            var StringData = JSON.stringify(req.body);
            var RawData = req.body;
            // Connect the client to the server
            const db = client.db(config.DB);
            var collection = db.collection("Players");
            var query = { GUID: GUID };
            const options = { upsert: true };
            const jsonString = "{ \"GUID\": \""+GUID+"\", \""+mod+"\": "+ StringData + " }";
            const updateDocValue  = JSON.parse(jsonString);
            const updateDoc = { $set: updateDocValue, };
            const result = await collection.updateOne(query, updateDoc, options);
            if (result.result.ok == 1){
                log("Updated "+ mod + " Data for GUID: " + GUID);
                res.status(200);
                res.json(RawData);
            } else {
                log("Error with Updating "+ mod + " Data for GUID: " + GUID, "warn");
                res.status(203);
                res.json(req.body);
            }
        }catch(err){
            res.status(203);
            res.json(req.body);
            log("ERROR: " + err, "warn");
        }finally{
            // Ensures that the client will close when you finish/error
            await client.close();
        }
    } else {
        res.status(401);
        res.json(req.body);
        log("AUTH ERROR: " + req.url, "warn");
    }
};


async function runUpdate(req, res, GUID, mod, auth) {
    if ( auth == config.ServerAuth || ((await CheckPlayerAuth(GUID, auth)) && config.AllowClientWrite) ){
        const client = new MongoClient(config.DBServer, { useUnifiedTopology: true });
        try{
            await client.connect();
            var RawData = req.body;
            var element = RawData.Element;
            var StringData;
            if (isObject(RawData.Value)){
                StringData = JSON.stringify(RawData.Value);
            } else if (isArray(RawData.Value)) {
                StringData = JSON.stringify(RawData.Value);
            } else {
                StringData = RawData.Value;
            }
            // Connect the client to the server
            const db = client.db(config.DB);
            var collection = db.collection("Players");
            var query = { GUID: GUID };
            const options = { upsert: false };
            const jsonString = "{ \""+mod+"."+element+"\": "+ StringData + " }";
            const updateDocValue  = JSON.parse(jsonString);
            const updateDoc = { $set: updateDocValue, };
            const result = await collection.updateOne(query, updateDoc, options);
            if (result.result.ok == 1 && Results.result.n > 0){
                log("Updated " + element +" for "+ mod + " Data for GUID: " + GUID);
                res.status(200);
                res.json({ Status: "Success", Element: element, Mod: mod, ID: GUID});
            } else {
                log("Error with Updating " + element +" for "+ mod + " Data for GUID: " + GUID, "warn");
                res.status(203);
                res.json({ Status: "Error", Element: element, Mod: mod, ID: GUID});
            }
        }catch(err){
            res.status(203);
            res.json({ Status: "Error", Element: element, Mod: mod, ID: GUID});
            log("ERROR: " + err, "warn");
        }finally{
            // Ensures that the client will close when you finish/error
            await client.close();
        }
    } else {
        res.status(401);
        res.json({ Status: "NoAuth", Element: element, Mod: mod, ID: GUID});
        log("AUTH ERROR: " + req.url, "warn");
    }
};

async function CheckPlayerAuth(guid, auth){
    var isAuth = false;
    const client = new MongoClient(config.DBServer, { useUnifiedTopology: true });
    if ((await CheckAuth(auth))){
        try{
            await client.connect();
            // Connect the client to the server        
            const db = client.db(config.DB);
            var collection = db.collection("Players");
            var SavedAuth = crypto.createHash('sha256').update(auth).digest('base64');
            var query = { GUID: guid, AUTH: SavedAuth };
            var results = collection.find(query);
                if ((await results.count()) != 0){
                    isAuth = true;
                }
        } catch(err){
            log("ID " + guid + " err" + err, "warn");
        } finally{
            await client.close();
            return isAuth;
        }
    }
    return isAuth;
}
 
module.exports = router;

isObject = function(a) {
    return (!!a) && (a.constructor === Object);
};


isArray = function(a) {
    return (!!a) && (a.constructor === Array);
};