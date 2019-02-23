import { ec as EC, eddsa as EdDSA } from 'elliptic';
import keccak from 'keccakjs';
import _ from 'lodash';
import moment from 'moment';
import fetch from 'node-fetch';
import { NativeModules } from 'react-native';
import utils from './utils';

const AES = NativeModules.Aes;

const PULLTIMEOUT = 9500;
const CURVE       = 'curve25519';
const CURVE_ED    = 'ed25519';

const CONNECTION_STATES = {
  'auth':           'AUTH',
  'wait_recipient': 'WAITING_RECIPIENT',
  'connected':      'CONNECTED',
};

module.exports = {
  async getID() {
    return _.isEmpty(this.id) ? (this.id = await AES.randomUuid()) : this.id;
  },
  getEC() {
    return _.isEmpty(this.ec) ? (this.ec = new EC(CURVE)) : this.ec;
  },
  getED() {
    return _.isEmpty(this.ed) ? (this.ed = new EdDSA(CURVE_ED)) : this.ed;
  },
  async getKeys() {
    return _.isEmpty(this.keys) ? (this.keys = this.getEC().genKeyPair({ entropy: await AES.randomKey(256) })) : this.keys;
  },
  getEDKeys(recipient) {
    return _.isEmpty(this.ed_keys) ? (this.ed_keys = this.getED().keyFromSecret(`${this.getID()}_${recipient}`)) : this.ed_keys;
  },
  getConnectionState() {
    return _.isEmpty(this.connectionState) ? (this.connectionState = CONNECTION_STATES['auth']) : this.connectionState;
  },
  setConnectionState(state) {
    if (CONNECTION_STATES.hasOwnProperty(state) === false) {
      console.log(JSON.stringify(CONNECTION_STATES));
      throw new Error('Unknown Connection State: ' + state);
    }
    this.connectionState = CONNECTION_STATES[state];
  },
  setEndpoint(endpoint) {
    this.endpoint = endpoint;
  },
  setRecipient(recipient) {
    this.recipient = recipient;
  },
  async defaultPayload(recipient) {
    if (_.isEmpty(recipient)) {
      if (_.isEmpty(this.recipient) === false) {
        recipient = this.recipient;
      } else if (_.isEmpty(recipient)) {
        throw new Error('Empty Recipient');
      }
    }

    return {
      sender: await this.getID(),
      recipient,
      action: 'auth',
    };
  },

  async auth(endpoint, recipient) {
    const payload       = await this.defaultPayload(recipient);
    const signedPayload = await this.signMessage(payload, payload.recipient);
    const response      = await fetch(endpoint, {
      body:    JSON.stringify(signedPayload),
      method:  'post',
      headers: { 'Content-Type': 'application/json' },
    });

    return response.json();
  },

  async signMessage(payload, recipient) {
    payload.date      = moment().format('x');
    payload.signature = await this.messageSignature(JSON.stringify(payload), recipient);

    return payload;
  },

  async messageSignature(msg, recipient) {
    return new Promise((resolve, reject) => {
      if (_.isEmpty(msg)) {
        return reject('Empty Payload');
      }

      const msgHash = new keccak().update(msg).digest('hex');
      resolve({
        sign: this.getEDKeys(recipient).sign(msgHash).toHex(),
        key:  this.getEDKeys(recipient).getPublic('hex'),
      });
    });
  },

  async check_pull(type, expected_action) {
    const payload       = await this.defaultPayload();
    payload.action      = 'pull';
    payload.pull_type   = type;
    const signedPayload = await this.signMessage(payload, payload.recipient);
    const response      = await fetch(this.endpoint, {
      timeout: PULLTIMEOUT,
      body:    JSON.stringify(signedPayload),
      method:  'post',
      headers: { 'Content-Type': 'application/json' },
    });

    const json = await response.json();
    if (json.hasOwnProperty('action') && json.action === expected_action) {
      return json;
    }
    return false;
  },

  async wait_for_recipient() {
    if (_.isEmpty(this.endpoint) || _.isEmpty(this.recipient)) {
      throw new Error('Can Not Wait For Auth');
    }
    let res = false;
    do {
      try {
        res = await this.check_pull('auth', 'connected');
      } catch (e) {
        console.log('wait_for_recipient_error', e.message);
      }
      if (res.hasOwnProperty('action') && res.action === 'connected') {
        return res;
      }
    } while (res === false);
  },

  async wait_for_message() {
    if (_.isEmpty(this.endpoint) || _.isEmpty(this.recipient)) {
      throw new Error('Can Not Wait For Message');
    }
    let res = false;
    do {
      try {
        res = await this.check_pull('messages', 'message');
      } catch (e) {
        console.log('wait_for_message_error', e.message);
      }
      if (res.hasOwnProperty('action') && res.action === 'message') {
        return res;
      }
    } while (res === false);
  },

  async sendHandshakeInit() {
    const keys = await this.getKeys();

    const payload       = await this.defaultPayload();
    payload.action      = 'message';
    payload.message     = {
      message_type: 'handshake',
      key_public:   keys.getPublic('hex'),
    };
    const signedPayload = await this.signMessage(payload, payload.recipient);
    const response      = await fetch(this.endpoint, {
      timeout: 500,
      body:    JSON.stringify(signedPayload),
      method:  'post',
      headers: { 'Content-Type': 'application/json' },
    });

    return response.json();
  },

  async sendHandshakeFinish() {
    const payload   = await this.defaultPayload();
    payload.action  = 'message';
    payload.message = await this.encryptMessage({ message_type: 'handshake_finish' });

    const signedPayload = await this.signMessage(payload, payload.recipient);
    const response      = await fetch(this.endpoint, {
      timeout: 500,
      body:    JSON.stringify(signedPayload),
      method:  'post',
      headers: { 'Content-Type': 'application/json' },
    });

    return response.json();
  },

  async sendTextMessage(msg) {
    const payload   = await this.defaultPayload();
    payload.action  = 'message';
    payload.message = await this.encryptMessage({
      message_type: 'text',
      msg,
    });

    const signedPayload = await this.signMessage(payload, payload.recipient);
    const response      = await fetch(this.endpoint, {
      timeout: 500,
      body:    JSON.stringify(signedPayload),
      method:  'post',
      headers: { 'Content-Type': 'application/json' },
    });

    return response.json();
  },

  async encryptMessage(msg) {
    if (_.isEmpty(this.aes_key)) {
      throw new Error('Cant Finish Handshake');
    }
    const key = utils.hexToBase64(this.aes_key);
    msg.hmac  = await AES.hmac256(JSON.stringify(msg), key);

    const iv           = await AES.randomKey(32);
    const encryptedMSG = await AES.encrypt(JSON.stringify(msg), key, iv);

    return {
      iv,
      msg: encryptedMSG,
    };
  },

  async decryptMessage(msg) {
    if (_.isEmpty(this.aes_key)) {
      throw new Error('Cant Finish Handshake');
    }
    const key          = utils.hexToBase64(this.aes_key);
    const decryptedMSG = await AES.decrypt(msg.msg, key, msg.iv);
    const msgParsed    = JSON.parse(decryptedMSG);
    const withoutHMAC  = _.cloneDeep(msgParsed);
    delete withoutHMAC.hmac;
    const confirmHMAC = await AES.hmac256(JSON.stringify(withoutHMAC), key);
    if (msgParsed.hmac !== confirmHMAC) {
      return null;
    }

    return msgParsed;
  },

  async handshake() {
    if (_.isEmpty(this.endpoint) || _.isEmpty(this.recipient)) {
      throw new Error('Can Not Handshake');
    }

    await this.sendHandshakeInit();
    const recipientInit = await this.wait_for_message();
    const message       = _.first(recipientInit.messages);
    if (message.message_type === 'handshake') {
      const keys       = await this.getKeys();
      const ec         = this.getEC();
      const pkey       = ec.keyFromPublic(message.key_public, 'hex');
      const messageKey = keys.derive(pkey.getPublic());
      this.aes_key     = messageKey.toString(16);

      await this.sendHandshakeFinish();
      const recipientFinish = await this.wait_for_message();
      const messageFinish   = await this.decryptMessage(_.first(recipientFinish.messages));
      if (messageFinish.hasOwnProperty('message_type') && messageFinish.message_type === 'handshake_finish') {
        return true;
      }
    }

    return false;
  },
};