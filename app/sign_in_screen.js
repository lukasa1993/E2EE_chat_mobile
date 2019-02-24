import React from 'react';
import { View } from 'react-native';
import { Button, Input } from 'react-native-elements';
import data_manager from './data_manager';

export default class SignInScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      id:        'tester',
      recipient: '',
//      endpoint:  'http://192.168.1.119:3535',
      endpoint:  'https://now-chat-e2ee.now.sh',
    };
  }

  static navigationOptions = {
    title: 'Please sign in',
  };

  async componentDidMount(): void {
    const id = await data_manager.getID();
    this.setState({ id });
  }

  render() {
    return (
      <View>
        <Input
          autoCapitalize='none'
          autoComplete='off'
          autoCorrect={false}
          autoFocus={false}
          dataDetectorTypes='link'
          value={this.state.id}
          inputStyle={{ fontSize: 12 }}
          onChangeText={id => this.setState({ id })}
          placeholder='https://example.com / 127.0.0.1'
          leftIconContainerStyle={{ marginRight: 10 }}
          leftIcon={{
            type: 'font-awesome',
            name: 'user',
          }}
        />
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
          inputStyle={{ fontSize: 12 }}
          leftIconContainerStyle={{ marginRight: 10 }}
          leftIcon={{
            type: 'font-awesome',
            name: 'user',
          }}
        />
        <Button title="Sign in!" onPress={() => this._signInAsync()} buttonStyle={{ marginTop: 20 }}/>
      </View>
    );
  }

  _signInAsync = async () => {
    try {
      data_manager.setID(this.state.id);
      await data_manager.auth(this.state.endpoint);
      data_manager.setConnectionState('wait_recipient');
      data_manager.setEndpoint(this.state.endpoint);
      data_manager.setRecipient(this.state.recipient);
      this.props.navigation.navigate('AuthLoading');
    } catch (e) {
      alert('Wrong Credentials');
      console.log(e);
    }
  };
}
