import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

// Multer throws its own error type for things like exceeding the size limit
// rather than an HttpException, so without this it surfaces as a bare 500 -
// not useful when the whole point of the limit is to show the user why their
// upload was rejected.
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const message = exception.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large.'
      : exception.message;

    response.status(HttpStatus.BAD_REQUEST).json({ statusCode: HttpStatus.BAD_REQUEST, message });
  }
}
