import React from 'react';
import { View } from 'react-native';
import { Button, Input, Text } from 'react-native-elements';
import data_manager from './data_manager';

export default class SignInScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      id:        '',
      recipient: '',
      endpoint:  'http://example.com',
    };
  }

  static navigationOptions = {
    title: 'Please sign in',
  };

  async componentDidMount(): void {
    const id = await data_manager.getID();
    this.setState({ getID: id });
  }

  render() {
    return (
      <View>
        <Text>Your ID:</Text>
        <Text style={{ textAlign: 'center' }} selectable={true}>{this.state.getID}</Text>
        <Input
          autoCapitalize='none'
          autoComplete='off'
          autoCorrect={false}
          autoFocus={false}
          dataDetectorTypes='link'
          value={this.state.endpoint}
          onChangeText={endpoint => this.setState({ endpoint })}
          placeholder='https://example.com / 127.0.0.1'
          leftIconContainerStyle={{ marginRight: 10 }}
          leftIcon={{
            type: 'font-awesome',
            name: 'server',
          }}
        />
        <Input
          autoCapitalize='none'
          autoComplete='off'
          autoCorrect={false}
          autoFocus={false}
          value={this.state.recipient}
          onChangeText={recipient => this.setState({ recipient })}
          placeholder='Recipient: eg. 1441031684069143253219203233207197611147223'
          inputStyle={{fontSize:12}}
          leftIconContainerStyle={{ marginRight: 10 }}
          leftIcon={{
            type: 'font-awesome',
            name: 'user',
          }}
        />
        <Button title="Sign in!" onPress={() => this._signInAsync()}/>
      </View>
    );
  }

  _signInAsync = async () => {
    try {
      const res = await data_manager.auth(this.state.endpoint, this.state.recipient);
      console.log(res);
      if (res.hasOwnProperty('action') && res.action === 'wait_recipient') {
        data_manager.setConnectionState(res.action);
        data_manager.setEndpoint(this.state.endpoint);
        data_manager.setRecipient(this.state.recipient);
        this.props.navigation.navigate('AuthLoading');
      }
    } catch (e) {
      console.log(e);
    }
  };
}
