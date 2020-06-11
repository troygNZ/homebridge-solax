import { AccessoryPlugin, HAP, Logger, Service } from "homebridge";
import { InverterStateEmitter } from "./solaxPlatform";
import InverterLiveMetrics from "./InverterLiveMetrics";

export default class SolarSnapshopCameraAccessory implements AccessoryPlugin {
  private readonly service: Service;
  private readonly informationService: Service;

  constructor(
    readonly hap: HAP,
    readonly log: Logger,
    readonly name: string,
    readonly inverterStateEmitter: InverterStateEmitter,
    readonly getMetrics: () => InverterLiveMetrics
  ) {
    this.service = new hap.Service.CameraRTPStreamManagement(name);
    this.service.name = name;
    // create handlers for required characteristics
    // this.service.getCharacteristic(hap.Characteristic.BatteryLevel).on("get", this.handleBatteryLevelGet.bind(this));
    // this.service.getCharacteristic(hap.Characteristic.ChargingState).on("get", this.handleChargingStateGet.bind(this));
    // this.service.getCharacteristic(hap.Characteristic.StatusLowBattery).on("get", this.handleStatusLowBatteryGet.bind(this));

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Solax")
      .setCharacteristic(hap.Characteristic.Model, "Camera");
    inverterStateEmitter.on("event", () => {
      const batteryValues = getMetrics();
      //log.debug(`Updating camera status for ${name}. Values:  ${JSON.stringify(batteryValues, null, "  ")}.`);
      //this.service.updateCharacteristic(hap.Characteristic.BatteryLevel, batteryValues.batteryPercentage);
      // this.service.updateCharacteristic(hap.Characteristic.ChargingState, this.determineChargingState(batteryValues));
    });
    log.info(`Solax Camera Accessory for ${name} created!`);
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log.debug("Identify!");
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [this.informationService, this.service];
  }
}
