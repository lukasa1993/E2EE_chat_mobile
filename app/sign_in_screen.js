import React from 'react';
import { AsyncStorage, View } from 'react-native';
import { Button, Input } from 'react-native-elements';

export default class SignInScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      endpoint: '',
    };
  }

  static navigationOptions = {
    title: 'Please sign in',
  };

  render() {
    return (
      <View>
        <Input
          onChangeText={endpoint => this.setState({ endpoint })}
          placeholder='https://example.com / 127.0.0.1'
          leftIconContainerStyle={{ marginRight: 10 }}
          leftIcon={{
            type: 'font-awesome',
            name: 'server',
          }}
        />
        <Button title="Sign in!" onPress={this._signInAsync}/>
      </View>
    );
  }

  _signInAsync = async () => {
    await AsyncStorage.setItem('userToken', 'abc');
    this.props.navigation.navigate('App');
  };
}
