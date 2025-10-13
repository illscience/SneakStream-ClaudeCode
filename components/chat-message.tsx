type Message = {
  id: string
  username: string
  text: string
  timestamp: string
  avatar?: string
}

type ChatMessageProps = {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className="flex gap-3 items-start">
      {/* Avatar Circle */}
      <div className="flex-shrink-0">
        {message.avatar ? (
          <img
            src={message.avatar || "/placeholder.svg"}
            alt={`${message.username}'s avatar`}
            className="w-10 h-10 rounded-full border-2 border-[#c4ff0e]"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c4ff0e] to-[#8bc34a] flex items-center justify-center text-black font-bold text-sm">
            {message.username.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1">
        <div className="flex items-baseline gap-2 mb-1">
          <span className={message.username === "illsci" ? "text-[#c4ff0e]" : "text-[#c4ff0e]"}>
            {message.username}
          </span>
          <span className="text-gray-500 text-sm">· {message.timestamp}</span>
        </div>
        <p className="text-white">{message.text}</p>
      </div>
    </div>
  )
}
