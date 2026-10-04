import { expectTypeOf, it } from 'vitest';
import type { SuccessBody } from './operationTypes';
import type { ApiData } from './transport';

it('derives every successful JSON response without a handwritten status list', () => {
  type Responses = {
    203: {
      content: {
        'application/json': { data: { source: 'cache' } };
      };
    };
    400: {
      content: {
        'application/json': { error: { code: 'invalid_request' } };
      };
    };
  };

  expectTypeOf<ApiData<SuccessBody<Responses>>>().toEqualTypeOf<{
    source: 'cache';
  }>();
});
