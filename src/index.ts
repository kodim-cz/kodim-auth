import express, { Router } from 'express';
import axios, { AxiosError, isAxiosError } from 'axios';
import cookieParser from 'cookie-parser';

interface KodimUser {
  email: string;
}

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
      res.status(403).send({
        status: 'unauthorized',
        errors: ['Missing or invalid authorization'],
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
            res.status(401).send({
              status: 'unauthorized',
              errors: ['Authorization rejected by kodim.cz']
            });
            return;
          }

          res.status(500).send({
            status: 'server error',
            errors: [
              `Error ${error.response.status} when authenticating agains kodim.cz`,
              error.message,
            ]
          });
          return;
        }
        
        if (error.request) {
          res.status(500).send({
            status: 'server error',
            errors: [
              `kodim.cz did not respond`,
              error.message,
            ]
          });
          return;
        }

        res.status(500).send({
          status: 'server error',
          errors: [
            `we could not setup a request to kodim.cz`,
            error.message,
          ]
        });
        return;
      }

      res.status(500).send({
        status: 'server error',
        errors: [
          'something went wrong when authenticating against kodim.cz',
          (error as Error).message,
        ]
      });
      return;
    }
  });

  return router;
};
