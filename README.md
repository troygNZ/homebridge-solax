<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

# Homebridge-Solax Platform Plugin

Use this plugin to monitor your Solax Inverter - to get realtime metrics from your inverter, and alerts for use with Automations. Inspired by the Solax connector for Home Assistant.

Note: HomeKit doesn't natively support a solar inverter or a watts based reader acccessory. To work around this, a light sensor accessory type was chosen - as its value range suited solar inverter metrics, with the excepof the minimum value. 0.1 is used to represent 0.

![Example Homekit Page](IMG_0931.PNG)

Requires the installation of the Solax Monitoring Dongle, and usage of a static IP address on your LAN. Refer to your Router configuration guide on how to do this.

Once you know the IP address of your Solax Inverter, navigate to http://<InverterIpAddress/>/api/realTimeData.htm
Here you should get a (malformed) JSON payload, but this will confirm it's possible to extract metrics from it.

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
        "latitude": -36.804993,
        "longitude": 175.132414,
        "exportAlertThresholds": [-5000, 0, 1000, 1500]
      }
    ]
```

**address**: The base hostname of your inverter connection dongle

**latitude**: _Optional_: Specifies the latitude of your solar installation. Used to determining accurate Sunset and Sunrise times.

**longitude**: _Optional_: Specifies the longitude of your solar installation. Used to determining accurate Sunset and Sunrise times.

**exportAlertThresholds**: _Optional_: Array of integers specifying the thresholds to create Alerts for. This will activate a motion trigger when the power export matches or exceeds the threshold value. Example: [-1000, 500, 2000] will create three motion sensors - "1000 watts imported", "500 watts exported" and "2000 watts exported".

### Leveraging in Automations via Motion Sensor Accessories

You can then create Automations in HomeKit as a result of the motion detection events (or them ceasing to happen).
Example: If 2000 watts or more is being exported, and heatpump isn't already cranked, then bump the temperature up.
