podTemplate(
  containers: [
    containerTemplate(name: 'worker', image: 'alpine:latest')
  ]
) {
  node(POD_LABEL) {
    stage('Download files from GitHub Release') {
      container('worker') {
        apk add --no-cache python3
        
      }
    }
  }
}
