const chalk = require('chalk');
const path = require('path');
var fs = require("fs");
const axios = require("axios");
const os = require('os');
var shell = require('shelljs');
const execCmd = require('../lib/execCmd');
const DOHelper = require('../lib/digitalOceanHelper')
const PropertiesReader = require('properties-reader');
const instanceFile = "instance.properties"

exports.command = 'prod up';
exports.desc = 'Create/Destroy production environment';
exports.builder = yargs => {
    yargs.options({
      'port': {
        alias: 'p',
        describe: 'Deployment port (defaults to 8080)',
        type: 'number',
        default: 8080
      }
    });
};

exports.handler = async argv => {
    const { processor, port } = argv;
    console.log(port);

    let token = process.env.DIGITAL_OCEAN_TOKEN;
    // console.log("here " + process.env.DIGITAL_OCEAN_TOKEN);
    // console.log(process.env);
    helper = new DOHelper(token);
    let poolSize = process.env.POOL_SIZE;
    if (!process.env.POOL_SIZE) {
      poolSize = 1;
    }
    console.log(chalk.green("Creating production environment..."));

    var fd = fs.openSync(instanceFile, 'a');
    let properties = PropertiesReader(instanceFile, { writer: { saveSections: true } });
    properties.set("POOL_SIZE", poolSize);
    properties.set("PORT", port);


    for (let i=0; i<poolSize; i++) {
      await helper.deleteDroplet(properties.get("BLUE_ID_" + i));
      let blueDropletId = await helper.createDroplet(process.env.DIGITAL_OCEAN_TOKEN, process.env.PUB_KEY_PATH);
      let blueDropletIp = await helper.getDropletIp(blueDropletId);
      properties.set("BLUE_ID_" + i, blueDropletId);
      properties.set("BLUE_IP_" + i, blueDropletIp);

      await helper.deleteDroplet(properties.get("GREEN_ID_" + i));
      let greenDropletId = await helper.createDroplet(process.env.DIGITAL_OCEAN_TOKEN, process.env.PUB_KEY_PATH);
      let greenDropletIp = await helper.getDropletIp(greenDropletId);
      properties.set("GREEN_ID_" + i, greenDropletId);
      properties.set("GREEN_IP_" + i, greenDropletIp);
    }

    await properties.save(instanceFile);

    await execCmd("forever stopall");
    await execCmd("forever start lib/lb.js");
};
