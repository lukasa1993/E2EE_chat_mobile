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

    data_manager.clearQueue();
    data_manager.setMessageCB(async message => {
      try { await this.handleMessage(message);} catch (e) { }
    });
  }

  async handleMessage(messagesPayload) {
    const messages = [await data_manager.decryptMessage(messagesPayload.message)];
    console.log('pullMessage', messages);
    const parsedMessages = [];
    _.forEach(messages, payload => {
      if (payload.message_type === 'text') {
        parsedMessages.push({
          _id:       payload.msg.msgid,
          text:      payload.msg.text,
          createdAt: new Date(payload.msg.created),
          user:      {
            _id:    2,
            avatar: 'https://placeimg.com/140/140/any',
          },
        });
      }
    });

    this.setState(previousState => ({
      messages: GiftedChat.append(previousState.messages, parsedMessages),
    }));
  }

  async sendMessage(messages) {
    await Promise.all(_.map(messages, async message => data_manager.sendTextMessage({
      msgid:   _.uniqueId(await data_manager.getID()),
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
        renderAccessory={() => <View style={{ height: ifIphoneX() ? 30 : 0 }}/>}
        user={{
          _id:    1,
          avatar: 'https://placeimg.com/140/140/any',
        }}
      />
    );
  }
}