import React from 'react';
import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['Require cycle']); // optional

let App: React.ComponentType<any>;
try {
  App = require('./App').default;
} catch (e) {
  console.error('App require failed:', e);
  throw e;
}

registerRootComponent(App);
