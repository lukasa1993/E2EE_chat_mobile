import _ from 'lodash';
import React from 'react';
import { View } from 'react-native';

import { GiftedChat } from 'react-native-gifted-chat';
import { ifIphoneX } from 'react-native-iphone-x-helper';

import data_manager from './data_manager';

export default class HomeScreen extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      arrayHolder: [],
      message:     '',
    };

  }

  static navigationOptions = {
    title: 'Welcome to the app!',
  };

  componentDidMount(): void {
    this.setState(previousState => ({
      messages: GiftedChat.append(previousState.messages, {
        _id:       19,
        text:      'successfully connected',
        createdAt: new Date(),
        system:    true,
      }),
    }));
    setInterval(async () => this.pullMessage(), 100);
  }

  async pullMessage() {
    const messagesPayload = await data_manager.wait_for_message();
    const messages        = await Promise.all(_.map(messagesPayload.messages, msg => data_manager.decryptMessage(msg)));
    const parsedMessages  = [];
    _.forEach(messages, payload => {
      parsedMessages.push({
        _id:       _.uniqueId('received'),
        text:      payload.msg.text,
        createdAt: new Date(payload.msg.created),
        user:      {
          _id:    2,
          avatar: 'https://placeimg.com/140/140/any',
        },
      });
    });

    this.setState(previousState => ({
      messages: GiftedChat.append(previousState.messages, parsedMessages),
    }));
  }

  async sendMessage(messages) {
    await Promise.all(_.map(messages, message => data_manager.sendTextMessage({
      text:    message.text,
      created: message.createdAt,
    })));

    this.setState(previousState => ({
      messages: GiftedChat.append(previousState.messages, messages),
    }));
  }

  render() {
    return (
      <GiftedChat
        isAnimated={true}
        messages={this.state.messages}
        onSend={messages => this.sendMessage(messages)}
        renderAccessory={() => {
          <View style={{ height: ifIphoneX() ? 30 : 0 }}/>;
        }}
        user={{ _id: 1 }}
      />
    );
  }
}