import 'react-native-get-random-values';
import 'fast-text-encoding';
import '@ethersproject/shims';

import {Buffer} from 'buffer';
global.Buffer = Buffer;

if (!global.process) {
  global.process = {env: {}, nextTick: setImmediate, version: '', platform: 'react-native'};
}
if (!global.process.env) global.process.env = {};
if (!global.process.nextTick) global.process.nextTick = setImmediate;

import './src/shared/utils/polyfills';

if (typeof Settings === 'undefined') {
  global.Settings = {};
}

import {registerRootComponent} from 'expo';
import App from './App';

registerRootComponent(App);
