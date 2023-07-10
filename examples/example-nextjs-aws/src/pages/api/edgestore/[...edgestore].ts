import EdgeStore from '@edge-store/react/next';
import { AWSProvider } from '@edge-store/react/providers';

type Context = {
  user: {
    id: string;
    name: string;
  };
};

export default EdgeStore({
  provider: AWSProvider<Context>({
    pathPrefix: async ({ req, res, ctx }) => {
      // wait 0.5 seconds to simulate a slow request
      await new Promise((resolve) => setTimeout(resolve, 500));
      return `/users/${ctx.user.id}`;
    },
    createContext: async ({ req, res }) => {
      // wait 0.5 seconds to simulate a slow request
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        user: {
          id: '123',
          name: 'John Doe',
        },
      };
    },
    onRequestUpload: async ({ req, res, ctx }) => {
      // wait 0.5 seconds to simulate a slow request
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log('onRequestUpload', ctx);
    },
  }),
});
