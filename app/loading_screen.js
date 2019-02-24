import React from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { Text } from 'react-native-elements';
import data_manager from './data_manager';

export default class AuthLoadingScreen extends React.Component {
  constructor(props) {
    super(props);
    this._bootstrapAsync();
  }

  _bootstrapAsync = async () => {
    let screen           = 'Auth';
    this.connectionState = data_manager.getConnectionState();
    switch (this.connectionState) {
      case 'AUTH':
        screen = 'Auth';
        break;
      case 'WAITING_RECIPIENT':
        data_manager.clearQueue();
        try {
          const handshake = await data_manager.handshake();
          if (handshake === true) {
            data_manager.setConnectionState('connected');
            screen = 'App';
          }
        } catch (e) {
          console.log(e);
          screen = 'Auth';
        }

        break;
      case 'CONNECTED':
        screen = 'App';
        break;
    }

    this.props.navigation.navigate(screen);

  };

  renderTitle() {
    if (this.connectionState === 'WAITING_RECIPIENT') {
      return <Text h4 style={{
        color:        'white',
        marginBottom: 40,
      }}>Waiting For Recipient</Text>;
    }

    return null;
  }

  render() {
    return (
      <View style={{
        flex:           1,
        alignItems:     'center',
        justifyContent: 'center',
      }}>
        <StatusBar barStyle="default"/>
        {this.renderTitle()}
        <ActivityIndicator size="large" color="white"/>
      </View>
    );
  }
}