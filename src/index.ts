import express, { Router } from 'express';
import axios, { AxiosError, isAxiosError } from 'axios';
import cookieParser from 'cookie-parser';
import jsonder from 'jsonder';

interface KodimUser {
  email: string;
}

const api = jsonder();

declare global {
  namespace Express {
    export interface Request {
      user?: KodimUser;
    }
  }
}

const getToken = (req: express.Request): string | null => {
  const authHeader = req.header('Authorization');
  
  if (authHeader === undefined) {
    return req.cookies.token ?? null;
  }

  const authParts = authHeader.split(' ');
  if (authParts.length !== 2 || authParts[0] !== 'Bearer') {
    return null;
  }

  return authParts[1];
}

export const kodimAuth = (): Router => {
  const router = express.Router();

  router.use(cookieParser());

  router.use(async (req, res, next) => {
    const token = getToken(req);

    if (token === null) {
      api.sendFail(res, {
        status: 401,
        code: 'invalid_auth_header',
        detail: 'Missing or invalid authorization header'
      });

      return;
    }

    try {
      const response = await axios.get('https://kodim.cz/api/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      req.user = { email: response.data.email };
      next();
      return;
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.response) {
          if (error.response.status === 401) {
            api.sendFail(res, {
              status: 401,
              code: 'unauthorized',
              detail: 'authentication rejected by kodim.cz',
              meta: {
                message: error.message,
              }
            });
            return;
          }

          api.sendFail(res, {
            status: 500,
            code: 'unknown_error',
            detail: `unknown error ${error.response.status} when authenticating against kodim.cz`,
            meta: {
              message: error.message,
            }
          });

          return;
        }
        
        if (error.request) {
          api.sendFail(res, {
            status: 500,
            code: 'no_response',
            detail: `there was no response from kodim.cz`,
            meta: {
              message: error.message,
            }
          });

          return;
        }

        api.sendFail(res, {
          status: 500,
          code: 'failed_request',
          detail: `could not send a request to kodim.cz`,
          meta: {
            message: error.message,
          }
        });

        return;
      }

      api.sendFail(res, {
        status: 500,
        code: 'unexpected_error',
        detail: `unexpected error when authenticating against kodim.cz`,
        meta: {
          message: (error as Error).message,
        }
      });

      return;
    }
  });

  return router;
};
