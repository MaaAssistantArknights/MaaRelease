podTemplate(
  containers: [
    containerTemplate(name: 'worker', image: 'alpine:latest', command: 'sleep', args: '1h')
  ]
) {
  node(POD_LABEL) {
    stage ('Install dependencies') {
      container('worker') {
        sh 'apk update --no-cache'
        sh 'apk add python3 git'
      }
    }

    stage('Checkout Repo') {
      container('worker') {
        dir('/tmp') {
          git branch: 'main', url: 'https://github.com/MaaArknightsAssistant/MaaRelease.git'
        }
      }
    }

    stage('Install python requirements') {
      container('worker') {
        dir('/tmp/MaaRelease/scripts') {
          sh 'python3 -m pip install -r requirements.txt'
        }
      }
    }

    stage('Download files from GitHub Release') {
      container('worker') {
        environment {
          GITHUB_TOKEN = credentials('maa-jenkins-robot-token')
        }
        dir('/tmp/MaaRelease/scripts') {
          sh 'python3 download.py'
        }
      }
    }

    stage('Upload files to Minio') {
      container('worker') {
        environment {
          MINIO_BUCKET = 'maa-release'
          MINIO_ENDPOINT = 'minio.local:9080'
          MINIO_ACCESS_KEY = credentials('maa-minio-robot-access-key')
          MINIO_SECRET_KEY = credentials('maa-minio-robot-secret-key')
        }
        dir('/tmp/MaaRelease/scripts') {
          sh 'python3 upload.py'
        }
      }
    }
  }
}
