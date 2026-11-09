from rest_framework import serializers

from tasks.models import Skill, TaskCategory
from .models import ExecutorProfile, WorkerSkill


class SkillCategorySerializer(serializers.ModelSerializer):

    class Meta:
        model = TaskCategory
        fields = [
            "category_id",
            "name",
        ]


class SkillReadSerializer(serializers.ModelSerializer):

    category = SkillCategorySerializer(read_only=True)

    class Meta:
        model = Skill
        fields = [
            "skill_id",
            "name",
            "description",
            "category",
        ]


class WorkerSkillReadSerializer(serializers.ModelSerializer):

    skill = SkillReadSerializer(read_only=True)

    class Meta:
        model = WorkerSkill
        fields = [
            "worker_skill_id",
            "skill",
            "proficiency_level",
            "experience_years",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class WorkerSkillCreateSerializer(serializers.Serializer):

    skill_id = serializers.UUIDField()

    proficiency_level = serializers.ChoiceField(
        choices=WorkerSkill.ProficiencyLevel.choices,
        required=False,
        default=WorkerSkill.ProficiencyLevel.BEGINNER,
    )

    experience_years = serializers.IntegerField(
        required=False,
        default=0,
        min_value=0,
        max_value=60,
    )

    def to_internal_value(self, data):

        allowed_fields = {
            "skill_id",
            "proficiency_level",
            "experience_years",
        }

        if hasattr(data, "keys"):

            unsupported = set(data.keys()) - allowed_fields

            if unsupported:
                raise serializers.ValidationError({
                    field: ["This field is not allowed."]
                    for field in unsupported
                })

        return super().to_internal_value(data)

    def validate_skill_id(self, value):

        try:
            skill = Skill.objects.select_related(
                "category"
            ).get(pk=value)

        except Skill.DoesNotExist:
            raise serializers.ValidationError(
                "The selected skill does not exist."
            )

        if skill.category_id and not skill.category.is_active:
            raise serializers.ValidationError(
                "This skill belongs to an inactive category."
            )

        return skill

    def validate(self, attrs):

        user = self.context["request"].user

        profile = ExecutorProfile.objects.filter(
            user=user
        ).first()

        if profile:

            already_exists = WorkerSkill.objects.filter(
                executor_profile=profile,
                skill=attrs["skill_id"],
            ).exists()

            if already_exists:
                raise serializers.ValidationError({
                    "skill_id": "This skill is already in your profile."
                })

        return attrs


class WorkerSkillUpdateSerializer(serializers.Serializer):

    proficiency_level = serializers.ChoiceField(
        choices=WorkerSkill.ProficiencyLevel.choices,
        required=False,
    )

    experience_years = serializers.IntegerField(
        required=False,
        min_value=0,
        max_value=60,
    )

    def to_internal_value(self, data):
        
        allowed_fields = {
            "proficiency_level",
            "experience_years",
        }
    
        if hasattr(data, "keys"):
        
            unsupported = set(data.keys()) - allowed_fields
    
            if unsupported:
                raise serializers.ValidationError({
                    field: ["This field cannot be updated."]
                    for field in unsupported
                })
    
            if not data:
                raise serializers.ValidationError({
                    "non_field_errors": [
                        "At least one field must be provided."
                    ]
                })
    
        return super().to_internal_value(data)