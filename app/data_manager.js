import fetch from 'node-fetch'
import { AsyncStorage } from 'react-native';

module.exports = {
  async auth() {
    const endpoint = await AsyncStorage.getItem('endpoint');
    const response = await fetch(endpoint);
  }
};