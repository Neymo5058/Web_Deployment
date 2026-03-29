import { config } from '@vue/test-utils';

config.global.stubs['ion-icon'] = {
  template: '<span class="ion-icon"><slot /></span>',
};

