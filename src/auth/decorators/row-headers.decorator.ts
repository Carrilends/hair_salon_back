import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const RawHeader = createParamDecorator((data, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.headers;
});
