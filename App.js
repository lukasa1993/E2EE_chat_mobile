import { createAppContainer, createStackNavigator, createSwitchNavigator } from 'react-navigation';
import HomeScreen from './app/home_screen';
import AuthLoadingScreen from './app/loading_screen';
import SignInScreen from './app/sign_in_screen';

const AppStack  = createStackNavigator({ Home: HomeScreen });
const AuthStack = createStackNavigator({ SignIn: SignInScreen });

export default createAppContainer(createSwitchNavigator(
  {
    AuthLoading: AuthLoadingScreen,
    App:         AppStack,
    Auth:        AuthStack,
  },
  {
    initialRouteName: 'AuthLoading',
  },
));