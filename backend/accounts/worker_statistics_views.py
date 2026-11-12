from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .worker_statistics_serializers import WorkerStatisticsSerializer
from .worker_statistics_services import get_worker_statistics


class WorkerStatisticsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Worker Dashboard"],
        summary="Get the current worker's dashboard statistics",
        responses={200: WorkerStatisticsSerializer},
    )
    def get(self, request):
        data = get_worker_statistics(user=request.user)
        return Response(WorkerStatisticsSerializer(instance=data).data)
