import os
from contextlib import asynccontextmanager
from fastapi import FastAPI,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import assessments,market,partners,compliance,sources,gtm,reports
@asynccontextmanager
async def lifespan(app:FastAPI): yield
app=FastAPI(title='Kizuna Gateway',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=[x for x in os.getenv('CORS_ORIGINS','http://localhost:3000').split(',') if x],allow_methods=['*'],allow_headers=['*'])
@app.exception_handler(Exception)
async def safe_error(request:Request,exc:Exception): return JSONResponse(status_code=500,content={'detail':'Internal server error'})
app.include_router(assessments.router,prefix='/api/v1');app.include_router(market.router,prefix='/api/v1');app.include_router(partners.router,prefix='/api/v1');app.include_router(compliance.router,prefix='/api/v1');app.include_router(sources.router,prefix='/api/v1');app.include_router(gtm.router,prefix='/api/v1');app.include_router(reports.router,prefix='/api/v1')
