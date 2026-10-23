"""Report replay is exposed from the assessments router to preserve its URL."""

from fastapi import APIRouter

router = APIRouter(tags=['reports'])
