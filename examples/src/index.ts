import { RICConnector } from '../../src/RICConnector';
import { connectBLE, connectWiFi, disconnectBLE, disconnectWiFi } from './connect';
import { sendREST, streamSoundFile } from './stream';
import { imuStatusFormat, robotStatusFormat, servoStatusFormat, addonListFormat, tableFormat, sysInfoGet } from './system';
import { Dictionary } from '../../src/RICTypes';

let startTime = Date.now();
globalThis.ricConnector = new RICConnector();

const prevStatus: Dictionary<string> = {};

function formatStatus(name: string, status: any, formatFn: any, elId: string) {
  if (!globalThis.ricConnector.isConnected() || !status) {
    if (prevStatus[name]) {
      document.getElementById(elId).innerHTML = "";
      delete prevStatus[name];
    }
    return;
  }
  const curStatusJSON = JSON.stringify(status);
  if (!(name in prevStatus) || (prevStatus[name] !== curStatusJSON)) {
    const newStatusHTML = formatFn(name, status);
    const container = document.getElementById(elId);
    container.innerHTML = newStatusHTML;
    prevStatus[name] = curStatusJSON;
  }
}

function updateStatus() {
  const statusContainer = document.getElementById('time-status-container');
  statusContainer.innerHTML = "";
  const status = document.createElement('div');
  const timeStr = ((Date.now() - startTime)/1000).toFixed(1);
  const connStr = globalThis.ricConnector.isConnected() ? "Connected" : "Disconnected";
  const connClass = globalThis.ricConnector.isConnected() ? "status-conn" : "status-disconn";
  const ricIMU = JSON.stringify(globalThis.ricConnector.getRICState().imuData, null, 2);
  status.innerHTML = `<div>Elapsed time ${timeStr}</div><div class="${connClass}">${connStr}</div>`;
  status.classList.add('status');
  statusContainer.appendChild(status);

  formatStatus("robotStatus", globalThis.ricConnector.getRICState().robotStatus, robotStatusFormat, "robot-status-container");
  formatStatus("imuStatus", globalThis.ricConnector.getRICState().imuData, imuStatusFormat, "imu-status-container");
  formatStatus("servoStatus", globalThis.ricConnector.getRICState().smartServos, servoStatusFormat, "servo-status-container");
  formatStatus("sysInfoStatus", globalThis.ricConnector.getRICSystem().getCachedSystemInfo(), tableFormat, "sysinfo-list-container");
  formatStatus("addonsStatus", globalThis.ricConnector.getRICSystem().getCachedHWElemList(), addonListFormat, "addon-list-container");
  formatStatus("calibStatus", globalThis.ricConnector.getRICSystem().getCachedCalibInfo(), tableFormat, "calib-list-container");
  formatStatus("nameStatus", {"friendlyName":globalThis.ricConnector.getRICSystem().getFriendlyName(),
                "RICName":globalThis.ricConnector.getRICSystem().getCachedRICName(),
                "RICNameIsSet":globalThis.ricConnector.getRICSystem().getCachedRICNameIsSet(),
            }, tableFormat, "friendlyname-list-container");
  // formatStatus("calibStatus", globalThis.ricConnector.getRICSystem().getCachedCalibInfo(), tableFormat, "calib-list-container");
  formatStatus("wifiStatus", globalThis.ricConnector.getRICSystem().getCachedWifiStatus(), tableFormat, "wifi-status-container");
}

function addButtons(defs: Array<{name: string, button: string, func: any, params: Array<string>}>, container: Element) {
  defs.forEach(def => {
    const buttonDiv = document.createElement('div');
    buttonDiv.classList.add('button-row');
    const buttonText = def.button.replace("%1", def.params[0]);
    buttonDiv.innerHTML = `<div class = "button-container"><span class="example-name">${def.name}</span><button class="list-button">${buttonText}</button></div>`;
    buttonDiv.addEventListener('click', () => {
      def.func(def.params);
    });
    container.appendChild(buttonDiv);
  });
}

function addFields(defs: Array<{name: string, elId: string}>, container: Element): void {
  defs.forEach(def => {
    const fieldDiv = document.createElement('div');
    fieldDiv.classList.add('field-row');
    fieldDiv.innerHTML = `<div class = "field-container"><span class="example-name">${def.name}</span><input id="${def.elId}" class="list-field" type="text"></div>`;
    container.appendChild(fieldDiv);
  });
}

function genStatusBlock(id: string, elclass: string, parent: Element): Element {
  const statusBlock = document.createElement('div');
  statusBlock.classList.add(elclass);
  statusBlock.id = id;
  parent.appendChild(statusBlock);
  return statusBlock;
}

function component() {
  const element = document.createElement('div');
  element.classList.add('main-container');

  const titleEl = document.createElement('h1');
  titleEl.innerHTML = "RICJS Example";
  titleEl.classList.add('title');
  element.appendChild(titleEl);

  const infoColumns = document.createElement('div');
  infoColumns.classList.add('info-columns');

  const statusContainer = document.createElement('div');
  statusContainer.classList.add('status-container');
  statusContainer.id = 'status-container';

  genStatusBlock('time-status-container', 'info-status-container', statusContainer);
  genStatusBlock('robot-status-container', 'info-status-container', statusContainer);
  genStatusBlock('imu-status-container', 'info-status-container', statusContainer);
  genStatusBlock('servo-status-container', 'info-status-container', statusContainer);
  genStatusBlock('sysinfo-list-container', 'info-status-container', statusContainer);
  genStatusBlock('addon-list-container', 'info-status-container', statusContainer);
  genStatusBlock('calib-list-container', 'info-status-container', statusContainer);
  genStatusBlock('friendlyname-list-container', 'info-status-container', statusContainer);
  genStatusBlock('wifi-status-container', 'info-status-container', statusContainer);
  
  const buttonsContainer = document.createElement('div');
  buttonsContainer.classList.add('buttons-container');

  // Buttons
  const bleConnDefs = [
    {name: "Connect BLE", button: "Connect", func: connectBLE, params: [] as Array<string>},
    {name: "Disconnect BLE", button: "Disconnect", func: disconnectBLE, params: []},
  ]

  const wifiIPDefs = [
    {name: "Wifi IP", elId: "wifi-ip"},
  ]

  const wifiPWDefs = [
    {name: "Wifi PW", elId: "wifi-pw"},
  ]

  const wifiConnDefs = [
    {name: "Connect WiFi", button: "Connect", func: connectWiFi, params: [] as Array<string>},
    {name: "Disconnect WiFi", button: "Disconnect", func: disconnectWiFi, params: [] as Array<string>},
  ]

  const buttonDefs = [
    {name: "Get SysInfo", button: "Get SysInfo", func: sysInfoGet, params: []},
    {name: "Stream MP3", button: "%1", func: streamSoundFile, params: ["test440ToneQuietShort.mp3"]},
    {name: "Stream MP3", button: "%1", func: streamSoundFile, params: ["completed_tone_low_br.mp3"]},
    {name: "Stream MP3", button: "%1", func: streamSoundFile, params: ["unplgivy.mp3"]},
    {name: "Circle", button: "%1", func: sendREST, params: ["traj/circle"]},
    {name: "Kick", button: "%1", func: sendREST, params: ["traj/kick"]},
    {name: "Walk", button: "%1", func: sendREST, params: ["traj/dance"]},
    {name: "Wiggle", button: "%1", func: sendREST, params: ["traj/wiggle"]},
    {name: "Eyes Wide", button: "%1", func: sendREST, params: ["traj/eyesWide"]},
    {name: "Eyes Normal", button: "%1", func: sendREST, params: ["traj/eyesNormal"]},
  ]

  // Add buttonDefs
  addButtons(bleConnDefs, buttonsContainer);
  addFields(wifiIPDefs, buttonsContainer);
  addButtons(wifiConnDefs, buttonsContainer);
  addFields(wifiPWDefs, buttonsContainer);
  addButtons(buttonDefs, buttonsContainer);

  infoColumns.appendChild(buttonsContainer);
  infoColumns.appendChild(statusContainer);

  element.appendChild(infoColumns);

  startTime = Date.now();
  setInterval(updateStatus, 100);

  return element;
}

document.body.appendChild(component());