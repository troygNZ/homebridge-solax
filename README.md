
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# Homebridge-Solax Platform Plugin

Use this plugin to monitor your Solax Inverter - to get realtime metrics from your inverter. Inspired by the Solax connector for Home Assistant.

Requires the installation of the Solax Monitoring Dongle, and usage of a static IP address on your LAN. Refer to your Router configuration guide on how to do this.

Once you know the IP address of your Solax Inverter, navigate to http://<InverterIpAddress/>/api/realTimeData.htm
Here you should get a (malformed) JSON payload.

## Installation
### Install Plugin
```
npm install homebridge-solax
```

### Configure
```
    "platforms": [
      {
        "platform" : "SolaxHomebridgePlugin",
        "name" : "Solax Inverter",
        "address": "http://192.168.1.40",
        "latitude": -37.804993,
        "longitude": 175.132414 
      }
    ]
```

`address`: The base hostname of your inverter connection dongle
`latitude`: Optional: Specifies the latitude of your solar installation. Used to determining accurate Sunset and Sunrise times.
`longitude`: Optional: Specifies the longitude of your solar installation. Used to determining accurate Sunset and Sunrise times.

### Leveraging in Automations
TBD
