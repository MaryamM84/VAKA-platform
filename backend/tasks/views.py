"""Create-only endpoint for a task draft."""
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import IsAuthenticated

from .models import Task
from .permissions import IsEmployer
from .serializers import TaskCreateSerializer


class TaskCreateView(CreateAPIView):
    queryset = Task.objects.all()
    serializer_class = TaskCreateSerializer
    permission_classes = [IsAuthenticated, IsEmployer]

    def perform_create(self, serializer):
        serializer.save(employer_user=self.request.user)
