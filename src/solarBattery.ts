import { AccessoryPlugin, HAP, Logger, Service } from "homebridge";
import { InverterStateEmitter } from "./solaxPlatform";

export interface BatteryDetails {
  batteryPercentage: number;
  batteryWatts: number;
}
export default class SolarBattery implements AccessoryPlugin {
  private readonly service: Service;
  private readonly informationService: Service;
  private previousWatts: number | null;

  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly name: string,
    private readonly inverterStateEmitter: InverterStateEmitter,
    private readonly getBatteryValues: () => BatteryDetails
  ) {
    this.service = new hap.Service.BatteryService(name);
    this.service.name = name;
    this.previousWatts = null;
    // create handlers for required characteristics
    this.service.getCharacteristic(hap.Characteristic.BatteryLevel).on("get", this.handleBatteryLevelGet.bind(this));
    this.service.getCharacteristic(hap.Characteristic.ChargingState).on("get", this.handleChargingStateGet.bind(this));
    this.service.getCharacteristic(hap.Characteristic.StatusLowBattery).on("get", this.handleStatusLowBatteryGet.bind(this));

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Solax")
      .setCharacteristic(hap.Characteristic.Model, "Inverter");

    inverterStateEmitter.on("event", () => {
      const batteryValues = getBatteryValues();
      log.debug(`Updating battery status for ${name}. Values:  ${JSON.stringify(batteryValues, null, "  ")}.`);
      this.service.updateCharacteristic(hap.Characteristic.BatteryLevel, batteryValues.batteryPercentage);
      this.service.updateCharacteristic(hap.Characteristic.ChargingState, this.determineChargingState(batteryValues));
    });
    log.info(`Solax Battery Accessory for ${name} created!`);
  }

  handleBatteryLevelGet = (callback: any): void => {
    const result = this.getBatteryValues().batteryPercentage;
    this.log.info(`GET for batteryLevel returned: ${result}`);
    callback(null, result);
  };

  handleChargingStateGet = (callback: any): void => {
    const result = this.determineChargingState(this.getBatteryValues());
    this.log.info(`GET for handleChargingStateGet returned: ${result}`);
    callback(null, result);
  };

  handleStatusLowBatteryGet = (callback: any): void => {
    callback(null, 0);
  };

  determineChargingState = (batteryValues: BatteryDetails): number => {
    const currentWatts = batteryValues.batteryWatts;
    const result = this.previousWatts === null || currentWatts > this.previousWatts ? 1 : 0;
    this.previousWatts = currentWatts;
    return result;
  };
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
