export const Loading = ({ message = 'Loading...' }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-lightBg">
      <div className="text-center">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary"></div>
        </div>
        <p className="mt-4 text-lg text-textLight">{message}</p>
      </div>
    </div>
  )
}

export default Loading
