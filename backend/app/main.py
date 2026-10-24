import os
from fastapi import Depends, FastAPI,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import assessments,market,partners,compliance,sources,gtm,reports,dev
from app.repositories.database import lifespan
from app.auth.dependencies import require_principal
app=FastAPI(title='Kizuna Gateway',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=[x for x in os.getenv('CORS_ORIGINS','http://localhost:3000').split(',') if x],allow_credentials=True,allow_methods=['GET','POST','PATCH'],allow_headers=['Authorization','Content-Type','If-Match','X-Request-ID'])
@app.exception_handler(Exception)
async def safe_error(request:Request,exc:Exception): return JSONResponse(status_code=500,content={'detail':'Internal server error'})
_authenticated = [Depends(require_principal)]
# Local development only: mints a token, so it must never sit behind the very
# verifier it issues tokens for. It self-disables unless DEV_AUTH_ENABLED is set.
app.include_router(dev.router,prefix='/api/v1')
app.include_router(assessments.router,prefix='/api/v1',dependencies=_authenticated);app.include_router(market.router,prefix='/api/v1',dependencies=_authenticated);app.include_router(partners.router,prefix='/api/v1',dependencies=_authenticated);app.include_router(compliance.router,prefix='/api/v1',dependencies=_authenticated);app.include_router(sources.router,prefix='/api/v1',dependencies=_authenticated);app.include_router(gtm.router,prefix='/api/v1',dependencies=_authenticated);app.include_router(reports.router,prefix='/api/v1',dependencies=_authenticated)
