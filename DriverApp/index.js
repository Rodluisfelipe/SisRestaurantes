// Notifee background handler + foreground-service runner must be registered
// before anything else so alerts work from a killed state.
import './src/notifeeSetup';

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App)
// and ensures the environment is set up appropriately for Expo Go and native builds.
registerRootComponent(App);
