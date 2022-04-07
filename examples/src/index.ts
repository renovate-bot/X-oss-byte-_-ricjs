import { acceptCheckCorrectRIC, connectBLE, connectWiFi, disconnect, rejectCheckCorrectRIC, startCheckCorrectRIC } from './connect';
import { sendREST, streamSoundFile } from './stream';
import { imuStatusFormat, robotStatusFormat, servoStatusFormat, addonListFormat, tableFormat, sysInfoGet, connPerfTest, setReconnect, pixGetColourStr, commsStatusFormat, powerStatusFormat } from './system';
import { Dictionary } from '../../src/RICTypes';
import { RICConnEvent } from '../../src/RICConnEvents';
import { RICUpdateEvent } from '../../src/RICUpdateEvents';
import RICConnector from '../../src/RICConnector';
import { fileDownloader, otaUpdateCancel, otaUpdateCheck, otaUpdateStart } from './update';

let startTime = Date.now();
function eventListener(eventType: string, eventEnum: RICConnEvent | RICUpdateEvent, eventName: string, eventData?: object | string | null) {
  const eventField = document.getElementById("event-field") as HTMLElement;
  if (eventField) {
    if (eventField.innerHTML.length === 0) {
      eventField.innerHTML = "<div>Events</div>";
    }
    const timeStr = ((Date.now() - startTime) / 1000).toFixed(1);
    eventField.innerHTML += `<div><span class="event-time-info">${timeStr}</span><span class="event-info">${eventName}<span></div>`;
  }

  // Handle specific events
  const checkField = document.getElementById("check-correct-ric-container") as HTMLElement;
  if (checkField) {
    if (eventType === 'conn') {
      switch (eventEnum) {
        case RICConnEvent.CONN_VERIFYING_CORRECT_RIC:
          {
            checkField.innerHTML = `<div>Check LEDs</div>`;
            const eventLeds = eventData! as Array<string>;
            for (let idx = 0; idx < eventLeds.length; idx++) {
              checkField.innerHTML += pixGetColourStr(idx, eventLeds[idx]);
            }
            break;
          }
        case RICConnEvent.CONN_VERIFIED_CORRECT_RIC:
          {
            checkField.innerHTML = `<div>Check LEDs ACCEPTED</div>`;
            break;
          }
        case RICConnEvent.CONN_REJECTED_RIC:
          {
            checkField.innerHTML = `<div>Check LEDs REJECTED</div>`;
            break;
          }
      }
    }
  }
}

globalThis.ricConnector = new RICConnector("2.0.0", 
    `https://updates.robotical.io/live/martyv2/rev{HWRevNo}/current_version.json`, 
    fileDownloader);
if (globalThis.ricConnector) {
  globalThis.ricConnector.setEventListener(eventListener);
}

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
    if (newStatusHTML !== "") {
      const container = document.getElementById(elId);
      container.innerHTML = newStatusHTML;
      prevStatus[name] = curStatusJSON;
    }
  }
}

function updateStatus() {
  const statusContainer = document.getElementById('time-status-container');
  statusContainer.innerHTML = "";
  const status = document.createElement('div');
  const timeStr = ((Date.now() - startTime) / 1000).toFixed(1);
  const connStr = globalThis.ricConnector.isConnected() ? "Connected to " + globalThis.ricConnector.getConnMethod() : "Disconnected";
  const connClass = globalThis.ricConnector.isConnected() ? "status-conn" : "status-disconn";
  const ricIMU = JSON.stringify(globalThis.ricConnector.getRICState().imuData, null, 2);
  status.innerHTML = `<div>Elapsed time ${timeStr}</div><div class="${connClass}">${connStr}</div>`;
  status.classList.add('status');
  statusContainer.appendChild(status);

  formatStatus("commsStatus", globalThis.ricConnector.getCommsStats(), commsStatusFormat, "comms-stats-container");
  formatStatus("robotStatus", globalThis.ricConnector.getRICState().robotStatus, robotStatusFormat, "robot-status-container");
  formatStatus("powerStatus", globalThis.ricConnector.getRICState().power, powerStatusFormat, "power-status-container");
  formatStatus("imuStatus", globalThis.ricConnector.getRICState().imuData, imuStatusFormat, "imu-status-container");
  formatStatus("servoStatus", globalThis.ricConnector.getRICState().smartServos, servoStatusFormat, "servo-status-container");
  formatStatus("sysInfoStatus", globalThis.ricConnector.getRICSystem().getCachedSystemInfo(), tableFormat, "sysinfo-list-container");
  formatStatus("addonsStatus", globalThis.ricConnector.getRICSystem().getCachedHWElemList(), addonListFormat, "addon-list-container");
  formatStatus("calibStatus", globalThis.ricConnector.getRICSystem().getCachedCalibInfo(), tableFormat, "calib-list-container");
  formatStatus("nameStatus", {
    "friendlyName": globalThis.ricConnector.getRICSystem().getFriendlyName(),
    "RICName": globalThis.ricConnector.getRICSystem().getCachedRICName(),
    "RICNameIsSet": globalThis.ricConnector.getRICSystem().getCachedRICNameIsSet(),
  }, tableFormat, "friendlyname-list-container");
  // formatStatus("calibStatus", globalThis.ricConnector.getRICSystem().getCachedCalibInfo(), tableFormat, "calib-list-container");
  formatStatus("wifiStatus", globalThis.ricConnector.getRICSystem().getCachedWifiStatus(), tableFormat, "wifi-status-container");
  setTimeout(updateStatus, 200);
}

function addButtons(defs: Array<{ name: string, button: string, func: any, params: Array<string | number | boolean> }>, container: Element) {
  defs.forEach(def => {
    const buttonDiv = document.createElement('div');
    buttonDiv.classList.add('button-row');
    let buttonText = def.button;
    if (buttonText === "%1") {
      buttonText = def.params[0] as string;
    }
    buttonDiv.innerHTML = `<div class = "button-container"><span class="example-name">${def.name}</span><button class="list-button">${buttonText}</button></div>`;
    buttonDiv.addEventListener('click', () => {
      def.func(def.params);
    });
    container.appendChild(buttonDiv);
  });
}

function addFields(defs: Array<{ name: string, elId: string }>, container: Element): void {
  defs.forEach(def => {
    const fieldDiv = document.createElement('div');
    fieldDiv.classList.add('field-row');
    fieldDiv.innerHTML = `<div class = "field-container"><span class="example-name">${def.name}</span><input id="${def.elId}" class="list-field" type="text"></div>`;
    container.appendChild(fieldDiv);
  });
}

function genStatusBlock(id: string, elclass: string | Array<string>, parent: Element): Element {
  const statusBlock = document.createElement('div');
  if (typeof elclass === 'string') {
    statusBlock.classList.add(elclass);
  } else {
    elclass.forEach(cls => {
      statusBlock.classList.add(cls);
    });
  }
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

  genStatusBlock('event-field', ['info-status-container', 'info-status-scroll'], statusContainer);
  genStatusBlock('time-status-container', 'info-status-container', statusContainer);
  genStatusBlock('check-correct-ric-container', ['info-status-container', 'info-status-scroll'], statusContainer);
  genStatusBlock('update-container', ['info-status-container', 'info-status-scroll'], statusContainer);
  genStatusBlock('conn-perf-status-container', 'info-status-container', statusContainer);
  genStatusBlock('robot-status-container', 'info-status-container', statusContainer);
  genStatusBlock('power-status-container', 'info-status-container', statusContainer);
  genStatusBlock('imu-status-container', 'info-status-container', statusContainer);
  genStatusBlock('servo-status-container', 'info-status-container', statusContainer);
  genStatusBlock('sysinfo-list-container', 'info-status-container', statusContainer);
  genStatusBlock('addon-list-container', 'info-status-container', statusContainer);
  genStatusBlock('calib-list-container', 'info-status-container', statusContainer);
  genStatusBlock('friendlyname-list-container', 'info-status-container', statusContainer);
  genStatusBlock('wifi-status-container', 'info-status-container', statusContainer);
  genStatusBlock('comms-stats-container', 'info-status-container', statusContainer);

  const buttonsContainer = document.createElement('div');
  buttonsContainer.classList.add('buttons-container');

  // Buttons
  const bleConnDefs = [
    { name: "Disconnect", button: "Disconnect", func: disconnect, params: [] as Array<string> },
    { name: "Connect BLE", button: "Connect", func: connectBLE, params: [] as Array<string> },
  ]

  const wifiIPDefs = [
    { name: "Wifi IP", elId: "wifi-ip" },
  ]

  const wifiPWDefs = [
    { name: "Wifi PW", elId: "wifi-pw" },
  ]

  const wifiConnDefs = [
    { name: "Connect WiFi", button: "Connect", func: connectWiFi, params: [] as Array<string> },
  ]

  const buttonDefs = [
    { name: "BLE Perf", button: "Perf Test BLE", func: connPerfTest, params: [] },
    { name: "Enable reconnect", button: "Reconnect 10s", func: setReconnect, params: [true, 10] },
    { name: "Disable reconnect", button: "No Reconnect", func: setReconnect, params: [false, 0] },
    { name: "Correct RIC?", button: "Check LEDs", func: startCheckCorrectRIC, params: [false, 0] },
    { name: "Correct RIC?", button: "Accept RIC", func: acceptCheckCorrectRIC, params: [false, 0] },
    { name: "Correct RIC?", button: "Reject RIC", func: rejectCheckCorrectRIC, params: [false, 0] },
    { name: "Get SysInfo", button: "Get SysInfo", func: sysInfoGet, params: [] },
    { name: "Update", button: "Check", func: otaUpdateCheck, params: [] },
    { name: "Update", button: "Perform", func: otaUpdateStart, params: [] },
    { name: "Update", button: "Cancel", func: otaUpdateCancel, params: [] },
    { name: "Stream MP3", button: "%1", func: streamSoundFile, params: ["test440ToneQuietShort.mp3"] },
    { name: "Stream MP3", button: "%1", func: streamSoundFile, params: ["completed_tone_low_br.mp3"] },
    { name: "Stream MP3", button: "%1", func: streamSoundFile, params: ["unplgivy.mp3"] },
    { name: "Circle", button: "%1", func: sendREST, params: ["traj/circle"] },
    { name: "Kick", button: "%1", func: sendREST, params: ["traj/kick"] },
    { name: "Walk", button: "%1", func: sendREST, params: ["traj/dance"] },
    { name: "Wiggle", button: "%1", func: sendREST, params: ["traj/wiggle"] },
    { name: "Eyes Wide", button: "%1", func: sendREST, params: ["traj/eyesWide"] },
    { name: "Eyes Normal", button: "%1", func: sendREST, params: ["traj/eyesNormal"] },
    { name: "5V On", button: "%1", func: sendREST, params: ["pwrctrl/5von"] },
    { name: "5V Off", button: "%1", func: sendREST, params: ["pwrctrl/5voff"] },
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
  setTimeout(updateStatus, 0);

  return element;
}

document.body.appendChild(component());
